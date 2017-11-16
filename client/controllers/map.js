import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import Locations from '/imports/collections/Locations';

Template.map.onCreated(function () {
  this.subscribe('locations');
  
  const bioevents = this.bioevents = new ReactiveVar([]);
  const selectedAirport = this.selectedAirport = new ReactiveVar();

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

    if(!_.isUndefined(this.data) && !_.isUndefined(this.data.airportId) )  {
      // When we search on a state or anything other than a single airport code, (more than one airport), will have to update this.
      const airports = Locations.find({ type: 'Airport', airportIds: this.data.airportId() }).fetch();
      _.each(airports, airport => {
        const coords = airport.coordinates[0];
        L.marker([coords[1], coords[0]]).addTo(map);
        this.selectedAirport.set( airport._id );
      });

    }  
  });
});
 
Template.map.helpers({
  bioevents: ()=>{
    return ["gfnPs88SBb3aaBeeA"];
  },
  selectedAirport: () => {
    return Template.instance().selectedAirport.get();
  },
  locations: () =>{
    return Locations.find().fetch().map( it => it.airportIds[0] );
  }
});
