import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import Locations from '/imports/collections/Locations';

Template.map.onCreated(function () {

  const instanceData  = this.data
  const loaded        = new ReactiveVar(false)
  const bioevents     = this.bioevents = new ReactiveVar([]);
  const selectedLocation = this.selectedLocation = new ReactiveVar();

  this.autorun(() => {
    const airportId     = FlowRouter.getParam('airportId');
    if( !_.isUndefined(airportId) ) {
      this.subscribe('locations', airportId)
    }
  });

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
  L.tileLayer.provider('Stamen.Terrain').addTo(map);
  map.setView([40.077946, -95.989253], 4);

  this.autorun(() => {
    const airportId   = FlowRouter.getParam('airportId');
    const locations   = Locations.find({ _id: airportId }).fetch();
    _.each(locations, location => {
      _.each(location.displayGeoJSON, feature => {
        if(feature.type == "Point") {
          const coords = feature.coordinates[0];
          L.marker([coords[1], coords[0]]).addTo(map);
          this.selectedLocation.set( location._id );
        }
      });
    });
  });
});
 
Template.map.helpers({
  bioevents: ()=>{
    return ["gfnPs88SBb3aaBeeA"];
  },
  selectedLocation: () => {
    return Template.instance().selectedLocation.get();
  },
  locations: () =>{
    return Locations.find().fetch().map( it => it.airportIds[0] );
  }
});
