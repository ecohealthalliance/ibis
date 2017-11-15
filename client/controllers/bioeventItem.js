Template.bioeventItem.onCreated(function () {
});
 
Template.bioeventItem.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  var map = L.map(this.$('.minimap')[0], {
    zoomControl:false,
    attributionControl: false
  });
  L.tileLayer.provider('Stamen.Watercolor').addTo(map);
  map.setView([40.077946, -95.989253], 2);
});
 
Template.bioeventItem.helpers({
  
});
