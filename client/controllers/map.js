import Locations from '/imports/collections/Locations';

Template.map.onCreated(function () {
  this.subscribe('locations');

});
 
Template.map.onRendered(function () {

  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  var map = L.map('map');
  L.tileLayer.provider('Stamen.Terrain').addTo(map);
  map.setView([40.077946, -95.989253], 4);

});
 

Template.map.helpers({
  locations: function() {
    return Locations.find().fetch().map( it => it.airportIds[0] );
  }
});
