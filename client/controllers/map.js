import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/world.geo.json';

Template.map.onCreated(function () {
  const bioevents = this.bioevents = new ReactiveVar([]);
  HTTP.get('https://eidr-connect.eha.io/api/events-with-resolved-data', {
    params: {
      ids:[
        // Test event ids
        'Hozt7LY7mJhcYxGQw',
        'YqpQ8B6QkTysGeR4Q',
        'vndMKRLPYS9pyc2ev',
        'gfnPs88SBb3aaBeeA'
      ]
    },
  }, (err, resp)=>{
    console.log(err, JSON.parse(resp.content));
    bioevents.set(JSON.parse(resp.content));
  });
});
 
Template.map.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  const map = L.map('map');
  const geoJsonLayer = L.geoJson(WorldGeoJSON, {
    style: (feature) =>{
      return {
        fillColor: '#FFFFFF',
        weight: 1,
        color: '#DDDDDD',
        fillOpacity: 1
      };
    }
  }).addTo(map);
  map.setView([40.077946, -95.989253], 4);
});
 
Template.map.helpers({
  bioevents: ()=>{
    return Template.instance().bioevents.get();
  }
});
