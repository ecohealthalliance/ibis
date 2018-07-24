/* global L, chroma, c3, FlowRouter, $ */
import { _ } from 'meteor/underscore';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import { Blaze } from 'meteor/blaze';
import { ReactiveVar } from 'meteor/reactive-var';

const RAMP = chroma.scale(["#ffffff", "#a10000"]).colors(10);
const getColor = (val) => {
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.bioeventItem.onCreated(function() {
  this.timelineType = new ReactiveVar({activeCases: true});
});

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
        fillColor: value ? getColor(Math.log10(1 + value) / Math.log10(1 + maxCasesForLocation)) : '#FFFFFF',
        weight: value ? 1 : 0,
        color: value ? getColor(Math.log10(1 + value) / Math.log10(1 + maxCasesForLocation)) : '#DDDDDD',
        fillOpacity: 1
      };
    }
  }).addTo(map);
  map.setView([30, 10], 0.25);
  // map.dragging.disable();
  // map.doubleClickZoom.disable();
  // map.scrollWheelZoom.disable();
  // map.touchZoom.disable();
  this.autorun(() => {
    const curTimelineType = this.timelineType.get();
    const startDateStr = this.data.dateRange.start.toISOString().split('T')[0];
    const endDateStr = this.data.dateRange.end.toISOString().split('T')[0];
    const timelineMax = this.data.timelineMax;
    var timeseries = this.data.bioevent.event.timeseries;
    if(curTimelineType.newCases) {
      timeseries = this.data.bioevent.event.dailyRateTimeseries.reduce((sofar, [date, value]) => {
        if(sofar.length > 0) {
          const prev = sofar.slice(-1)[0];
          return sofar.concat([
            [prev[0], value],
            [date, value]
          ]);
        } else {
          return [[date, value]];
        }
      }, []);
    }
    let formattedTimeseries = timeseries.map(([date, value], idx) => {
      // The date is slightly perturbed to ensure that it always increasing.
      // Equal dates can cause errors in the plot.
      return {
        date: Number(new Date(date)) + idx,
        value: value
      };
    });
    const formatNumber = (x) => {
      const value = Math.pow(10, x) - 1;
      if(value >= 1000) {
        return value.toPrecision(1);
      } else {
        return value.toFixed(0);
      }
    };
    const dayBeforeEndStr = new Date(
      new Date(this.data.dateRange.end).setDate(this.data.dateRange.end.getDate() - 1)
    ).toISOString().split('T')[0];
    const chart = c3.generate({
      bindto: this.$('.timeline')[0],
      padding: {
        right: 20,
        left: 40,
        top: 10
      },
      data: {
        json: formattedTimeseries.map((x) => {
          x = Object.create(x);
          x.value = Math.log10(1 + x.value);
          return x;
        }),
        keys: {
          x: 'date',
          value: ['value'],
        },
        type: 'area',
        color: () => '#ffffff',
        labels : {
          show: true,
          format: {
            data1: formatNumber
          }
        }
      },
      axis: {
        x: {
          min: startDateStr,
          max: endDateStr,
          tick: {
            // The final tick is the day before the right bound so the label
            // fits.
            values: [startDateStr, dayBeforeEndStr],
            format: (x)=> new Date(x).toISOString().split('T')[0]
          },
          type: 'timeseries',
          show: true
        },
        y: {
          min: 0,
          max: Math.log10(timelineMax),
          tick: {
            values: [0, Math.log10(timelineMax) / 2, Math.log10(timelineMax)],
            format: formatNumber
          },
          show: true
        }
      },
      legend: {
        show: false
      }
    });
  });
});

Template.bioeventItem.helpers({
  eventType: () => "auto-events",
  timelineType: () => {
    return Template.instance().timelineType.get();
  }
});

Template.bioeventItem.events({
  'click .timeline-type': (event, instance) => {
    const timelineType = $(event.target).data('timeline-type');
    instance.timelineType.set({
      newCases: timelineType == "newCases",
      activeCases: timelineType == "activeCases"
    });
  },
  'click .rank-score': (event, instance) => {
    let bioevent = instance.data.bioevent;
    $('#rank-info-modal').modal('show');
    $('#rank-info-modal .content').replaceWith('<div class="content modal-body">');
    Blaze.renderWithData(Template.rankInfo, {
      locationId: FlowRouter.getParam('locationId'),
      eventId: bioevent.event._id
    }, $('#rank-info-modal .content')[0]);
  }
});
