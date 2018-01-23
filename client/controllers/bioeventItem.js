import WorldGeoJSON from '/imports/geoJSON/world.geo.json';

const RAMP = chroma.scale(["#ffffff", "#a10000"]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.bioeventItem.onCreated(function () {
});
 
Template.bioeventItem.onRendered(function () {
  const map = L.map(this.$('.minimap')[0], {
    zoomControl:false,
    attributionControl: false
  });
  const locationMap = this.data.event.locations;
  const maxValue = _.max(WorldGeoJSON.features.map(
    (feature)=> locationMap[feature.properties.iso_a2]
  ));
  const geoJsonLayer = L.geoJson(WorldGeoJSON, {
    style: (feature) =>{
      const value = locationMap[feature.properties.iso_a2];
      return {
        fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
        weight: value ? 1 : 0,
        color: value ? getColor(value / 10000) : '#DDDDDD',
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
  const timelineMax = _.max(_.pluck(this.data.event.timeseries, 'value'));
  const chart = c3.generate({
    bindto: this.$('.timeline')[0],
    padding: {
      right: 10
    },
    title: {
      text: 'Cases per day'
    },
    data: {
      json: this.data.event.timeseries.map((x) => {
        x.date = x.date.split('T')[0];
        return x;
      }),
      keys: {
        x: 'date',
        value: ['value'],
      },
      type: 'area',
      color: () => '#ffffff'
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
        max: timelineMax,
        tick: {
            values: [0, timelineMax],
            format: (x) => x.toPrecision(1)
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

});
