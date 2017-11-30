import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/world.geo.json';

const RAMP = chroma.scale(["#a10000", "#f07381"]).colors(10)
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.map.onCreated(function () {
  const bioevents = this.bioevents = new ReactiveVar([]);
  const bioeventIds = this.bioeventIds = new ReactiveVar([]);
  const bioeventIdsForPage = this.bioeventIdsForPage = new ReactiveVar([]);
  HTTP.get('/api/locations/airport:SEA/bioevents', {}, (err, resp)=> {
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
          ids: bioeventIdsToGet
        },
      }, (err, resp)=> {
        bioevents.set(JSON.parse(resp.content));
      });
    }
  });
});
 
Template.map.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  let location = "airport:SEA";
  HTTP.get(`/api/locations/${location}/inboundTrafficByCountry`, {
    // params: {
    //   arrivesBefore: "2017-10-10"
    // }
  }, (err, resp)=> {
    const map = L.map('map');
    const maxValue = _.max(_.values(resp.data));
    const geoJsonLayer = L.geoJson(WorldGeoJSON, {
      style: (feature) =>{
        // TODO: Use ISO2 codes for inboundTrafficByCountry resp. keys.
        const data = resp.data[feature.properties.name_long];
        const value = data ? data.numSeats : null;
        return {
          fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
          weight: 1,
          color: '#DDDDDD',
          fillOpacity: 1
        };
      }
    }).addTo(map);
    map.setView([40.077946, -95.989253], 4);
  });
});
 
Template.map.helpers({
  bioevents: ()=>{
    return Template.instance().bioevents.get();
  }
});
