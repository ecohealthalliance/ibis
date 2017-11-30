import WorldGeoJSON from '/imports/world.geo.json';

const RAMP = chroma.scale(["#a10000", "#f07381"]).colors(10)
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.bioeventItem.onCreated(function () {
});
 
Template.bioeventItem.onRendered(function () {
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  const map = L.map(this.$('.minimap')[0], {
    zoomControl:false,
    attributionControl: false
  });
  const locationMap = this.data.locations;
  const maxValue = _.max(WorldGeoJSON.features.map(
    (feature)=>locationMap[feature.properties.iso_a2]
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
  const endDate = new Date();
  const startDateStr = new Date(endDate - 600 * 60 * 60 * 24 * 1000).toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const chart = c3.generate({
    bindto: this.$('.timeline')[0],
    data: {
      json: this.data.timeseries.map((x) => {
        x.date = x.date.split('T')[0];
        return x;
      }),
      keys: {
        x: 'date', // it's possible to specify 'x' when category axis
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
      y: { show: false }
    },
    legend: {
      show: false
    }
  });
});

Template.bioeventItem.helpers({

});
