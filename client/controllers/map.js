/* global L, _, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
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

Template.map.onCreated(function () {
  this.mapType = new ReactiveVar("passengerFlow");
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY),
    end: endDate
  };
  const selectedLocation = this.selectedLocation = new ReactiveVar();
  this.autorun(() => {
    this.subscribe('locations', FlowRouter.getParam('locationId'));
  });
});
 
Template.map.onRendered(function () {
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = L.layerGroup([]).addTo(map);
  const renderGeoJSON = (mapData, units="")=>{
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    geoJsonLayer.clearLayers();
    let marker = null;
    geoJsonLayer.addLayer(L.geoJson(WorldGeoJSON, {
      style: (feature)=>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
          weight: 1,
          color: '#DDDDDD',
          fillOpacity: 1
        };
      },
      onEachFeature: (feature, layer)=>{
        layer.on('mouseover', (event)=>{
          if(marker){
            geoJsonLayer.removeLayer(marker);
          }
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
    }));
  };
  renderGeoJSON({});
  const mapType = this.mapType;
  this.autorun(()=>{
    const locationId = FlowRouter.getParam('locationId');
    const location = Locations.findOne({ _id: locationId });
    this.selectedLocation.set(location);
    let route, valueProp, units;
    const mapTypeValue = mapType.get();
    if(!location) return;
    if(mapTypeValue === "passengerFlow"){
      route = "passengerFlowsByCountry";
      valueProp = "estimatedPassengers";
      units = "passengers per day";
    } else {
      route = "inboundTrafficByCountry";
      valueProp = "numSeats";
      units = "seats per day";
    }
    HTTP.get(`/api/locations/${locationId}/${route}`, {
      // params: {
      //   arrivesBefore: "2017-10-10"
      // }
    }, (err, resp)=> {
      if(err) return console.error(err);
      let result = {};
      for(let id in resp.data) {
        result[id] = resp.data[id][valueProp];
      }
      renderGeoJSON(result, units);
      L.geoJson({features: location.displayGeoJSON }).addTo(map);
    });
  });
});
 
Template.map.helpers({
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
  },
  selectedLocationName: () => {
    const selectedLocation = Template.instance().selectedLocation.get();
    if(selectedLocation) {
      return selectedLocation.displayName + (selectedLocation.type === "airport" ? " Airport" : "");
    }
  }
});

Template.map.events({
  'change #map-type': (event, instance)=>{
    instance.mapType.set(event.target.value);
  }
});
