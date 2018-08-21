/* global L, _, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import Constants from '/imports/constants';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import { INBOUND_RAMP, OUTBOUND_RAMP, INBOUND_LINE, OUTBOUND_LINE, getColor } from '/imports/ramps';
import typeToTitle from '/imports/typeToTitle';
import displayLayers from '/imports/displayLayers';

const mapTypes = [
  {name:"threatLevelExUS", label:"Threat Level Exposure (Ex. US)"},
  {name:"threatLevel", label:"Threat Level Exposure"},
  {name:"passengerFlow", label:"Estimated Inbound Passenger Flow"},
];

Template.splash.onCreated(function() {
  this.mapType = new ReactiveVar();
  this.autorun(()=>{
    this.mapType.set(FlowRouter.getQueryParam("mapType") || "threatLevelExUS");
  });
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
    });
  });
});
 
Template.splash.onRendered(function() {
  const map = L.map('map', Constants.LEAFLET_MAP_CONFIG);
  map.setView(Constants.INITIAL_MAP_VIEW, 4);
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
          fillColor: value ? getColor(value / maxValue, INBOUND_RAMP) : '#FFFFFF',
          weight: 1,
          color: INBOUND_LINE,
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
    const displayLayersVal = displayLayers.get();
    const showBubbles = _.findWhere(displayLayersVal, {name: 'bubbles'}).active;
    const showChoropleth = _.findWhere(displayLayersVal, {name: 'choropleth'}).active;
    locations.map((location)=>{
      let value = location[this.mapType.curValue];
      if(location.type === 'state' && value > stateMax) stateMax = value;
      if(location.type === 'airport' && value > airportMax) airportMax = value;
    });
    locations.forEach((location)=>{
      if(!showBubbles && location.type == 'airport') return;
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
        pointToLayer: (feature, latlng)=>{
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
        style: (feature)=>{
          let maxValue = location.type === 'airport' ? airportMax : stateMax;
          return {
            fillColor: value && (location.type === 'airport' || showChoropleth) ? getColor(value / maxValue, INBOUND_RAMP) : '#FFFFFF',
            weight: 1,
            color: INBOUND_LINE,
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              const popupElement = $('<div>').get(0);
              Blaze.renderWithData(Template.locationPopup, {
                location: location,
                properties: [{
                  value: location[this.mapType.curValue],
                  label: _.findWhere(mapTypes, {name: this.mapType.curValue}).label
                }]
              }, popupElement);
              layer.bindPopup(popupElement)
                .openPopup()
                .unbindPopup();
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
                color: OUTBOUND_LINE,
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
  legendTitle: () => "Incoming " + typeToTitle[Template.instance().mapType.get()],
  legendRamp: () => INBOUND_RAMP,
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return mapTypes.map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  },
  layers: () => displayLayers
});

Template.splash.events({
  'change #map-type': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": event.target.value});
  }
});