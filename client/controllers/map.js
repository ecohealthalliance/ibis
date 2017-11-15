import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';

Template.map.onCreated(function () {
  const bioevents = this.bioevents = new ReactiveVar([]);
  HTTP.get("https://eidr-connect.eha.io/api/events-with-resolved-data", {
    data: {
      ids:[
        // Test event ids
        "Hozt7LY7mJhcYxGQw",
        "YqpQ8B6QkTysGeR4Q",
        "vndMKRLPYS9pyc2ev",
        "gfnPs88SBb3aaBeeA"
      ]
    },
  }, (err, result)=>{
    console.log(err, result);
    bioevents.set(result);
  });
});
 
Template.map.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  var map = L.map('map');
  L.tileLayer.provider('Stamen.Watercolor').addTo(map);
  map.setView([40.077946, -95.989253], 4);
});
 
Template.map.helpers({
  bioevents: ()=>{
    return ["gfnPs88SBb3aaBeeA"];
  }
});
