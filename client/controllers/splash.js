/* global L, _, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import Locations from '/imports/collections/Locations';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import Constants from '/imports/constants';

const RAMP = chroma.scale(["#ffffff", Constants.PRIMARY_COLOR]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.splash.onCreated(function() {
  this.locations = new ReactiveVar([]);
  HTTP.get('/api/topLocations', {}, (err, resp)=> {
    if(err) return console.error(err);
    this.locations.set(resp.data.locations);
  });
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - 600 * Constants.MILLIS_PER_DAY),
    end: endDate
  };
});
 
Template.splash.onRendered(function() {
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = null;
  const renderGeoJSON = (mapData, units="")=>{
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    if(geoJsonLayer){
      map.removeLayer(geoJsonLayer);
    }
    let marker = null;
    let markerForLayer = null;
    geoJsonLayer = L.layerGroup([L.geoJson(WorldGeoJSON, {
      style: (feature) =>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
          weight: 1,
          color: '#DDDDDD',
          // Hide the US since it will be shown in the states layer.
          fillOpacity: feature.properties.iso_a2 == 'US' ? 0.0 : 1.0
        };
      },
      onEachFeature: (feature, layer) =>{
        layer.on('mouseover', (event)=>{
          if(marker){
            if(layer !== markerForLayer){
              geoJsonLayer.removeLayer(marker);
            } else {
              return;
            }
          }
          markerForLayer = layer;
          let value = mapData[feature.properties.iso_a2] || 0;
          marker = L.marker(event.latlng, {
            icon: L.divIcon({
              className: "hover-marker",
              html: `${feature.properties.name_long}: ${Math.floor(value).toLocaleString()} ${units}`
            })
          });
          geoJsonLayer.addLayer(marker);
        });
      }
    })]).addTo(map);
  };
  renderGeoJSON({});
  let hoverMarker = null;
  this.autorun(()=> {
    let locations = this.locations.get();
    let airportMax = 0;
    let stateMax = 0;
    locations.map((x)=>{
      if(x.type === 'state' && x.totalPassengers > stateMax) stateMax = x.totalPassengers;
      if(x.type === 'airport' && x.totalPassengers > airportMax) airportMax = x.totalPassengers;
    });
    locations.forEach((location)=>{
      if(!location.displayGeoJSON) return;
      var geojsonMarkerOptions = {
          radius: 1 + 12 * location.totalPassengers / airportMax,
          weight: 0,
          opacity: 1
      };
      const marker = L.geoJson({features: location.displayGeoJSON}, {
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
        style: (feature) =>{
          let value = location.totalPassengers;
          let maxValue = location.type === 'airport' ? airportMax : stateMax;
          return {
            fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
            weight: 1,
            color: '#DDDDDD',
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              console.log(location._id);
              FlowRouter.go('/locations/:locationId', {locationId: location._id});
            },
            mouseover: (event)=>{
              if(hoverMarker) {
                map.removeLayer(hoverMarker);
              }
              hoverMarker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: `${location.displayName}: ${Math.floor(location.totalPassengers).toLocaleString()} passengers per day`
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
      }).addTo(map);
    });
  });
});
 
Template.splash.helpers({
  dateRange: ()=> Template.instance().dateRange,
});

Template.splash.events({

});