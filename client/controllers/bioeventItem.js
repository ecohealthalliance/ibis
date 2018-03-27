/* global L, chroma, c3, FlowRouter */
import { _ } from 'meteor/underscore';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import { Blaze } from 'meteor/blaze';

const RAMP = chroma.scale(["#ffffff", "#a10000"]).colors(10);
const getColor = (val) => {
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.bioeventItem.onCreated(function() {});

Template.bioeventItem.onRendered(function() {
  const map = L.map(this.$('.minimap')[0], {
    zoomControl: false,
    attributionControl: false
  });
  const locationMap = this.data.bioevent.event.locations;
  const maxCasesForLocation = this.data.maxCasesForLocation;
  const geoJsonLayer = L.geoJson(WorldGeoJSON, {
    style: (feature) => {
      const value = locationMap[feature.properties.iso_a2];
      return {
        fillColor: value ? getColor(Math.log(1 + value) / Math.log(1 + maxCasesForLocation)) : '#FFFFFF',
        weight: value ? 1 : 0,
        color: value ? getColor(Math.log(1 + value) / Math.log(1 + maxCasesForLocation)) : '#DDDDDD',
        fillOpacity: 1
      };
    }
  }).addTo(map);
  map.setView([30, 10], 0.25);
  // map.dragging.disable();
  // map.doubleClickZoom.disable();
  // map.scrollWheelZoom.disable();
  // map.touchZoom.disable();
  const startDateStr = this.data.dateRange.start.toISOString().split('T')[0];
  const endDateStr = this.data.dateRange.end.toISOString().split('T')[0];
  const timelineMax = this.data.timelineMax;
  let formattedTimeseries = [];
  let prev = null;
  this.data.bioevent.event.timeseries.forEach((x) => {
    if (prev) {
      formattedTimeseries.push({
        date: prev.date,
        value: x.value
      });
    }
    x.date = x.date.split('T')[0];
    formattedTimeseries.push(x);
    prev = x;
  });
  const chart = c3.generate({
    bindto: this.$('.timeline')[0],
    padding: {
      right: 20,
      left: 40,
      top: 10
    },
    title: {
      text: 'Cases per day'
    },
    data: {
      json: formattedTimeseries.map((x) => {
        x.value = Math.log(1 + x.value) / Math.LN10;
        return x;
      }),
      keys: {
        x: 'date',
        value: ['value'],
      },
      type: 'area',
      color: () => '#ffffff',
      labels : {
        show:true,
        format: {
          data1: (x) => (Math.pow(10, x) - 1).toFixed(0)
        }
      }
    },
    axis: {
      x: {
        min: startDateStr,
        max: endDateStr,
        tick: {
          // this also works for non timeseries data
          values: [startDateStr, endDateStr]
        },
        type: 'timeseries',
        show: true
      },
      y: {
        min: 0,
        max: Math.log(timelineMax) / Math.LN10,
        tick: {
          values: [0, Math.log(timelineMax) / Math.LN10 / 2, Math.log(timelineMax) / Math.LN10],
          format: (x) => (Math.pow(10, x) - 1).toPrecision(1)
        },
        show: true
      }
    },
    legend: {
      show: false
    }
  });
});

Template.bioeventItem.helpers({
  eventType: () => "auto-events"
});

Template.bioeventItem.events({
  'click .rank-score': (event, instance) => {
    let bioevent = instance.data.bioevent;
    $('#rank-info-modal').modal('show');
    Blaze.renderWithData(Template.rankInfo, {
      locationId: FlowRouter.getParam('locationId'),
      eventId: bioevent.event._id
    }, $('#rank-info-modal .content')[0]);
  }
});
