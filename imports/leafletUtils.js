/* global L */
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import { _ } from 'meteor/underscore';
import { getColor } from '/imports/ramps';
import { formatNumber } from '/imports/utils';

module.exports = {
  renderAllCountryGeoJSONLayer: (map, mapData, maxValue, ramp, lineColor, units="")=>{
    if(map.geoJsonLayer){
      map.removeLayer(map.geoJsonLayer);
    }
    map.geoJsonLayer = L.layerGroup([L.geoJson(WorldGeoJSON, {
      style: (feature)=>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue, ramp) : '#FFFFFF',
          weight: 1,
          color: lineColor,
          // Hide the US since it will be shown in the states layer.
          fillOpacity: feature.properties.iso_a2 == 'US' ? 0.0 : 1.0
        };
      },
      onEachFeature: (feature, layer)=>{
        layer.on('mouseover', (event)=>{
          if(map.hoverMarker) {
            map.removeLayer(map.hoverMarker);
          }
          let value = mapData[feature.properties.iso_a2] || 0;
          map.hoverMarker = L.marker(event.latlng, {
            icon: L.divIcon({
              className: "hover-marker",
              html: `${feature.properties.name_long}: ${formatNumber(value)} ${units}`
            })
          }).addTo(map);
        });
      }
    })]).addTo(map);
  }
};
