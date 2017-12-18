/* global L, _, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import Locations from '/imports/collections/Locations';
import WorldGeoJSON from '/imports/world.geo.json';

const MILLIS_PER_DAY = 60 * 60 * 24 * 1000;
const RAMP = chroma.scale(["#ffffff", "#a10000"]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.splash.onCreated(function() {
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - 600 * MILLIS_PER_DAY),
    end: endDate
  };
});
 
Template.splash.onRendered(function() {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
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
          fillOpacity: 1
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
              className: "country-name",
              html: `${feature.properties.name_long}: ${Math.floor(value).toLocaleString()} ${units}`
            })
          });
          geoJsonLayer.addLayer(marker);
        });
      }
    })]).addTo(map);
  };
  renderGeoJSON({});
});
 
Template.splash.helpers({
  dateRange: ()=> Template.instance().dateRange,
});

Template.splash.events({

});