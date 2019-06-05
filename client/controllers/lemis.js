/* global $, L */
import { FlowRouter } from 'meteor/kadira:flow-router';
import { _ } from 'meteor/underscore';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import Constants from '/imports/constants';
import { INBOUND_RAMP, OUTBOUND_RAMP, INBOUND_LINE, OUTBOUND_LINE, getColor } from '/imports/ramps';
import typeToTitle from '/imports/typeToTitle';
import loadingIndicator from '/imports/loadingIndicator';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { showHelpPanel } from '/imports/configuration';
const mapTypes = [
  "lemisQuantity",
  "lemisRecords",
  "lemisValue"
].map((x) => {
  return {name: x, label: typeToTitle[x]};
});

Template.lemis.onCreated(function() {
  this.mapType = new ReactiveVar();
  this.autorun(()=>{
    this.mapType.set(FlowRouter.getQueryParam("mapType") || 'lemisQuantity');
  });
  this.locations = new ReactiveVar([]);
  this.autorun(()=>{
    const metric = this.mapType.get();
    const bioeventId = FlowRouter.getQueryParam('bioeventId') || null;
    const loadingIndicatorSemaphore = loadingIndicator.show();
    HTTPAuthenticatedGet('/api/lemis', {
      params: {
        metric: metric,
        bioeventId: bioeventId
      }
    })
      .finally(()=>loadingIndicator.hide(loadingIndicatorSemaphore))
      .then((lemisResp)=>{
        this.locations.set(lemisResp.data);
      });
  });
});
 
Template.lemis.onRendered(function() {
  const map = this.map = L.map('map', Constants.LEAFLET_MAP_CONFIG);
  const countryCenters = this.countryCenters = {};
  map.setView([0, 60], 2);
  let geoJsonLayer = null;
  let hoverMarker = null;
  const renderGeoJSON = (mapData, units="")=>{
    const maxValue = _.max(_.values(mapData));
    if(geoJsonLayer){
      map.removeLayer(geoJsonLayer);
    }
    geoJsonLayer = L.layerGroup([L.geoJson(WorldGeoJSON, {
      style: (feature)=>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue, INBOUND_RAMP) : '#FFFFFF',
          weight: 1,
          color: INBOUND_LINE,
          fillOpacity: 1.0
        };
      },
      onEachFeature: (feature, layer)=>{
        countryCenters[feature.properties.iso_a2] = () => {
          let maxArea = 0;
          let maxCenter = layer.getCenter();
          if(layer.feature.geometry.type == "MultiPolygon") {
            layer.feature.geometry.coordinates.forEach(([coords])=>{
              const bounds = new L.Polygon(coords.map(([x, y])=>[y, x])).getBounds();
              const area = Math.abs(bounds.getNorth() - bounds.getSouth()) * Math.abs(bounds.getEast() - bounds.getWest());
              if(area > maxArea) {
                maxCenter = bounds.getCenter();
                maxArea = area;
              }
            });
          }
          return maxCenter;
        };
        layer.on('click', (event)=>{
          const popupElement = $('<div>').get(0);
          Blaze.renderWithData(Template.lemisPopup, {
            location: feature.properties
          }, popupElement);
          L.popup()
            .setLatLng(map.mouseEventToLatLng(event.originalEvent))
            .setContent(popupElement)
            .openOn(map);
        });
        layer.on('mouseover', (event)=>{
          if(hoverMarker) {
            map.removeLayer(hoverMarker);
          }
          let value = mapData[feature.properties.iso_a2] || 0;
          hoverMarker = L.marker(event.latlng, {
            icon: L.divIcon({
              className: "hover-marker",
              html: `${feature.properties.name_long}: ${Math.floor(value).toLocaleString()} ${units}`
            })
          }).addTo(map);
        });
      }
    })]).addTo(map);
  };
  renderGeoJSON({});
  this.autorun(()=> {
    let locations = this.locations.get();
    let mapType = this.mapType.get();
    renderGeoJSON(_.object(locations.map((location) =>
      [location._id, location[mapType]]
    )), Constants.mapTypeToUnits[mapType]);
  });
});
 
Template.lemis.helpers({
  unit: () => Constants.mapTypeToUnits[Template.instance().mapType.get()],
  legendTitle: () => typeToTitle[Template.instance().mapType.get()],
  legendRamp: () => INBOUND_RAMP,
  helpPanelVisible: () => showHelpPanel.get() ? "help-showing" : "",
  mapTypes: () => {
    const selectedType = Template.instance().mapType.get();
    return mapTypes.map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  },
  mapType: () => Template.instance().mapType,
  moneyType: () => Template.instance().mapType.get() == "lemisValue",
  topLocations: () => {
    const instance = Template.instance();
    const locations = instance.locations.get();
    const mapType = instance.mapType.get();
    const mapData = _.object(locations.map((location) =>
      [location._id, location[mapType]]
    ));
    return _.sortBy(WorldGeoJSON.features.map((feature) => {
      return {
        feature: feature,
        name: feature.properties.name,
        value: mapData[feature.properties.iso_a2]
      };
    }), 'value').filter(x => x.value).reverse();
  }
});

Template.lemis.events({
  'change #map-type': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": event.target.value});
  },
  'click .location': function(event, instance){
    const feature = this.feature;
    const iso2 = this.feature.properties.iso_a2;
    const popupElement = $('<div>').get(0);
    Blaze.renderWithData(Template.lemisPopup, {
      location: feature.properties
    }, popupElement);
    const coords = instance.countryCenters[iso2]();
    L.popup()
      .setLatLng(coords)
      .setContent(popupElement)
      .openOn(instance.map);
    const panCoords = _.extend({}, coords, {lng: coords.lng + 15});
    instance.map.flyTo(panCoords, 4);
  }
});