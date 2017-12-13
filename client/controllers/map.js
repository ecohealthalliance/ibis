/* global L, _, chroma */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/world.geo.json';

const MILLIS_PER_DAY = 60 * 60 * 24 * 1000;
const RAMP = chroma.scale(["#a10000", "#f07381"]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.map.onCreated(function () {
  this.mapType = new ReactiveVar("passengerFlow");
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - 600 * MILLIS_PER_DAY),
    end: endDate
  };
  const bioevents = this.bioevents = new ReactiveVar([]);
  const bioeventIds = this.bioeventIds = new ReactiveVar([]);
  const bioeventIdsForPage = this.bioeventIdsForPage = new ReactiveVar([]);
  HTTP.get('/api/locations/airport:SEA/bioevents', {}, (err, resp)=> {
    if(err) return console.error(err);
    bioeventIds.set(resp.data.ids);
  });
  this.autorun(()=> {
    // TODO: Add pagination
    bioeventIdsForPage.set(bioeventIds.get());
  });
  this.autorun(()=> {
    let bioeventIdsToGet = bioeventIdsForPage.get();
    if(bioeventIdsToGet.length > 0) {
      HTTP.get('https://eidr-connect.eha.io/api/events-with-resolved-data', {
        params: {
          ids: bioeventIdsToGet,
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        },
      }, (err, resp)=> {
        if(err) return console.error(err);
        bioevents.set(resp.data.events);
      });
    }
  });
});
 
Template.map.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = null;
  const renderGeoJSON = (mapData)=>{
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
              html: feature.properties.name_long + ": " + value.toFixed(0)
            })
          });
          geoJsonLayer.addLayer(marker);
        });
      }
    })]).addTo(map);
  };
  renderGeoJSON({});
  const mapType = this.mapType;
  this.autorun(()=>{
    let location = "airport:JFK";
    let route, valueProp;
    const mapTypeValue = mapType.get();
    if(mapTypeValue === "passengerFlow"){
      route = "passengerFlowsByCountry";
      valueProp = "estimatedPassengers";
    } else {
      route = "inboundTrafficByCountry";
      valueProp = "numSeats";
    }
    HTTP.get(`/api/locations/${location}/${route}`, {
      // params: {
      //   arrivesBefore: "2017-10-10"
      // }
    }, (err, resp)=> {
      if(err) return console.error(err);
      let result = {};
      for(let id in resp.data) {
        result[id] = resp.data[id][valueProp];
      }
      renderGeoJSON(result);
    });
  });
});
 
Template.map.helpers({
  bioevents: ()=> Template.instance().bioevents.get(),
  dateRange: ()=> Template.instance().dateRange,
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return [
      {name:"directSeats", label:"Direct Seats"},
      {name:"passengerFlow", label:"Estimated Passenger Flow"},
    ].map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  }
});

Template.map.events({
  'change #map-type': (event, instance)=>{
    console.log(event);
    instance.mapType.set(event.target.value);
  }
});