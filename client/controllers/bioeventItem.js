/* global L, chroma, c3, FlowRouter, $ */
import { _ } from 'meteor/underscore';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import { Blaze } from 'meteor/blaze';
import { ReactiveVar } from 'meteor/reactive-var';
import { INBOUND_RAMP, OUTBOUND_RAMP, getColor } from '/imports/ramps';
import { constrainMaps } from '/imports/configuration';

Template.bioeventItem.onRendered(function() {
  const map = L.map(this.$('.minimap')[0], {
    zoomControl: false,
    attributionControl: false
  });
  if(constrainMaps.get()) {
    map.dragging.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.disable();
  }
  const locationMap = this.data.bioevent.event.locations;
  const maxCasesForLocation = this.data.maxCasesForLocation;
  const geoJsonLayer = L.geoJson(WorldGeoJSON, {
    style: (feature)=>{
      const value = locationMap[feature.properties.iso_a2];
      return {
        fillColor: value ? getColor(Math.log10(1 + value) / Math.log10(1 + maxCasesForLocation), OUTBOUND_RAMP) : '#FFFFFF',
        weight: value ? 1 : 0,
        color: value ? getColor(Math.log10(1 + value) / Math.log10(1 + maxCasesForLocation), OUTBOUND_RAMP) : '#DDDDDD',
        fillOpacity: 1
      };
    }
  }).addTo(map);
  map.setView([30, 10], 0.25);
});

Template.bioeventItem.helpers({
  bioeventFilterActive: ()=>FlowRouter.getQueryParam('bioeventId') === Template.instance().data.bioevent.event.eventId
})

Template.bioeventItem.events({
  'click .rank-score': (event, instance)=>{
    let bioevent = instance.data.bioevent;
    $('#rank-info-modal').modal('show');
    $('#rank-info-modal .content').replaceWith('<div class="content modal-body">');
    Blaze.renderWithData(Template.rankInfo, {
      locationId: FlowRouter.getParam('locationId'),
      eventId: bioevent.event._id
    }, $('#rank-info-modal .content')[0]);
  },
  'click .filter-map': (event, instance)=>{
    if(FlowRouter.getQueryParam('bioeventId') === instance.data.bioevent.event.eventId) {
      FlowRouter.setQueryParams({
        'bioeventId': null
      });
    } else {
      FlowRouter.setQueryParams({
        'bioeventId': instance.data.bioevent.event.eventId
      });
    }
  }
});
