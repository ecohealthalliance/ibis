/* global L, _, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import Constants from '/imports/constants';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';

const RAMP = chroma.scale(["#ffffff", Constants.PRIMARY_COLOR]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.splash.onCreated(function() {
  this.mapType = new ReactiveVar("threatLevelExUS");
  this.locations = new ReactiveVar([]);
  this.autorun(()=>{
    const metric = this.mapType.get();
    Promise.all([
      new Promise((resolve, reject) =>{
        HTTP.get('/api/topLocations', {
          params: {
            metric: metric
          }
        }, (err, resp)=> {
          if(err) return reject(err);
          resolve(resp.data);
        });
      }), locationGeoJsonPromise
    ]).then(([topLocations, locationGeoJson])=>{
      const airportValues = topLocations.airportValues;
      this.locations.set(_.map(locationGeoJson, (location, locationId)=>{
        location = Object.create(location);
        location[metric] = 0;
        location.airportIds.forEach((airportId)=>{
          location[metric] += airportValues[airportId] || 0;
        });
        if(location[metric] == 0) return;
        location._id = locationId;
        location.type = locationId.split(':')[0];
        return location;
      }).filter(x=>x));
    })
    
  });
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY),
    end: endDate
  };
});
 
Template.splash.onRendered(function() {
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = null;
  let hoverMarker = null;
  const renderGeoJSON = (mapData, units="")=>{
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    if(geoJsonLayer){
      map.removeLayer(geoJsonLayer);
    }
    geoJsonLayer = L.layerGroup([L.geoJson(WorldGeoJSON, {
      style: (feature)=>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
          weight: 1,
          color: '#DDDDDD',
          // Hide the US since it will be shown in the states layer.
          fillOpacity: feature.properties.iso_a2 == 'US' ? 0.0 : 1.0
        };
      },
      onEachFeature: (feature, layer)=>{
        layer.on('mouseover', (event)=>{
          if(hoverMarker) {
            map.removeLayer(hoverMarker);
          }
          let value = mapData[feature.properties.iso_a2] || 0;
          hoverMarker = L.marker(event.latlng, {
            icon: L.divIcon({
              className: "hover-marker",
              html: `${feature.properties.name_long}: ${Math.floor(value).toLocaleString()} ${units}`
            })
          }).addTo(map);
        });
      }
    })]).addTo(map);
  };
  renderGeoJSON({});
  let locationLayer = null;
  this.autorun(()=> {
    let layers = [];
    let locations = this.locations.get();
    let airportMax = 0;
    let stateMax = 0;
    locations.map((location)=>{
      let value = location[this.mapType.curValue];
      if(location.type === 'state' && value > stateMax) stateMax = value;
      if(location.type === 'airport' && value > airportMax) airportMax = value;
    });
    locations.forEach((location)=>{
      if(!location.displayGeoJSON) return;
      let value = location[this.mapType.curValue];
      var geojsonMarkerOptions = {
        // The radius is a squre root so that the marker's volume is directly
        // proprotional to the value.
        radius: Math.sqrt(2 + 144 * value / airportMax),
        weight: 0,
        opacity: 1
      };
      const marker = L.geoJson({features: location.displayGeoJSON}, {
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
        style: (feature) =>{
          let maxValue = location.type === 'airport' ? airportMax : stateMax;
          // if(_.isNaN(value / maxValue)) {
          //   console.log(value, maxValue, location)
          // }
          return {
            fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
            weight: 1,
            color: '#888',
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              FlowRouter.go('/locations/:locationId', {locationId: location._id});
            },
            mouseover: (event)=>{
              if(hoverMarker) {
                map.removeLayer(hoverMarker);
              }
              hoverMarker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: location.displayName + ": " + (this.mapType.curValue === "passengerFlow" ?
                    Math.floor(value).toLocaleString() + " passengers per day" :
                    value.toFixed(2))
                })
              }).addTo(map);
              layer.setStyle({
                weight: 2,
                color: Constants.PRIMARY_COLOR
              });
              window.setTimeout(()=>{
                marker.resetStyle(layer);
              }, 300);
            }
          });
        }
      });
      layers.push(marker);
    });
    if(locationLayer) {
      map.removeLayer(locationLayer);
    }
    locationLayer = new L.layerGroup(layers).addTo(map);
  });
});
 
Template.splash.helpers({
  dateRange: ()=> Template.instance().dateRange,
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return [
      {name:"threatLevelExUS", label:"Threat Level Exposure Map (Ex. US)"},
      {name:"threatLevel", label:"Threat Level Exposure Map"},
      {name:"passengerFlow", label:"Estimated Inbound Passenger Flow Map"},
    ].map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  }
});

Template.splash.events({
  'change #map-type': (event, instance)=>{
    instance.mapType.set(event.target.value);
  }
});