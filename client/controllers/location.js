/* global L, FlowRouter, $ */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import Constants from '/imports/constants';
import { _ } from 'meteor/underscore';
import { INBOUND_RAMP, OUTBOUND_RAMP, getColor } from '/imports/ramps';
import typeToTitle from '/imports/typeToTitle';
import displayLayers from '/imports/displayLayers';

const mapTypes = [
  { name: "directSeats", label: "Direct Seats by Origin" },
  { name: "passengerFlow", label: "Estimated Passenger Flow by Origin" },
  { name: "threatLevel", label: "Threat Level by Origin" }
];

Template.location.onCreated(function() {
  this.mapType = new ReactiveVar();
  this.locationData = new ReactiveVar();
  this.autorun(()=>{
    this.mapType.set(FlowRouter.getQueryParam("mapType") || "threatLevel");
  });
  this.selectedLocation = new ReactiveVar();
  this.locations = [];
  locationGeoJsonPromise.then((locations) => {
    this.locations = locations;
    this.autorun(() => {
      const locationId = FlowRouter.getParam('locationId');
      const location = locations[locationId];
      this.selectedLocation.set({
        type: locationId.startsWith("airport") ? "airport" : "state",
        displayName: location.displayName
      });
      let route;
      const mapTypeValue = this.mapType.get();
      if (!location) return;
      if (mapTypeValue === "passengerFlow") {
        route = "passengerFlows";
      } else if (mapTypeValue === "threatLevel") {
        route = "threatLevel";
      } else {
        route = "inboundTraffic";
      }
      HTTP.get(`/api/locations/${locationId}/${route}`, {}, (err, resp) => {
        if (err) return console.error(err);
        this.locationData.set(resp.data);
      });
    });
  });
});

Template.location.onRendered(function() {
  let marker = null;
  const map = L.map('map');
  map.setView(Constants.INITIAL_MAP_VIEW, 4);
  let geoJsonLayer = L.layerGroup([]).addTo(map);
  const renderGeoJSON = (mapData, units = "") => {
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    geoJsonLayer.clearLayers();
    geoJsonLayer.addLayer(L.geoJson(WorldGeoJSON, {
      style: (feature) => {
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(.7 * value / maxValue, OUTBOUND_RAMP) : '#FFFFFF',
          weight: 1,
          color: OUTBOUND_RAMP[9],
          fillOpacity: 1
        };
      },
      onEachFeature: (feature, layer) => {
        layer.on('mouseover', (event) => {
          if (marker) {
            geoJsonLayer.removeLayer(marker);
          }
          let value = mapData[feature.properties.iso_a2] || 0;
          marker = L.marker(event.latlng, {
            icon: L.divIcon({
              className: "hover-marker",
              html: `${feature.properties.name_long}: ${value.toLocaleString()} ${units}`
            })
          });
          geoJsonLayer.addLayer(marker);
        });
      }
    }));
  };
  renderGeoJSON({});
  this.autorun(() => {
    const data = this.locationData.get();
    const locationId = FlowRouter.getParam('locationId');
    if (!data) return;
    const mapTypeValue = this.mapType.curValue;
    let units;
    if (mapTypeValue === "passengerFlow") {
      units = "passengers per day";
    } else if (mapTypeValue === "threatLevel") {
      units = "rank score";
    } else {
      units = "seats per day";
    }
    const displayLayersVal = displayLayers.get();
    const showBubbles = _.findWhere(displayLayersVal, {
      name: 'bubbles'
    }).active;
    const showChoropleth = _.findWhere(displayLayersVal, {
      name: 'choropleth'
    }).active;
    let result = {};
    const countryGroups = data.countryGroups;
    for (let id in countryGroups) {
      result[id] = countryGroups[id][mapTypeValue];
    }
    if (showChoropleth) {
      renderGeoJSON(result, units);
    } else {
      renderGeoJSON({});
    }
    const displayGeoJSON = this.locations[locationId].displayGeoJSON;
    geoJsonLayer.addLayer(L.geoJson({
      features: displayGeoJSON
    }, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 10,
          opacity: 1
        });
      },
      style: (feature) => {
        return {
          fillColor: INBOUND_RAMP[5],
          weight: 1,
          color: INBOUND_RAMP[9],
          fillOpacity: 1
        };
      },
    }));
    if(!showBubbles) return;
    let maxValue = _.max(data.allAirports.map((x) => x[mapTypeValue]));
    geoJsonLayer.addLayer(L.geoJson({
      features: data.allAirports.map((x)=>{
        const key = 'airport:' + x._id;
        if(!(key in this.locations)) return;
        const location = _.extend({}, this.locations[key], x, {_id: key});
        return {
          "type": "Feature",
          "geometry": this.locations[key].displayGeoJSON[0],
          "properties": location
        };
      }).filter(x=>x)
    }, {
      pointToLayer: function (feature, latlng) {
        let value = feature.properties[mapTypeValue];
        return L.circleMarker(latlng, {
          // The radius is a squre root so that the marker's volume is directly
          // proprotional to the value.
          radius: Math.sqrt(2 + (value / maxValue) * 144),
          opacity: 1
        });
      },
      style: (feature) => {
        let value = feature.properties[mapTypeValue];
        return {
          fillColor: value ? getColor(.7 * value / maxValue, OUTBOUND_RAMP): '#FFFFFF',
          weight: 1,
          color: OUTBOUND_RAMP[9],
          fillOpacity: 1
        };
      },
      onEachFeature: (feature, layer) => {
        layer.on({
          click: (event)=>{
            const popupElement = $('<div>').get(0);
            Blaze.renderWithData(Template.locationPopup, {
              location: feature.properties,
              properties: [{
                value: feature.properties[mapTypeValue],
                label: _.findWhere(mapTypes, {name: mapTypeValue}).label
              }]
            }, popupElement);
            layer.bindPopup(popupElement)
              .openPopup()
              .unbindPopup();
          },
          mouseover: (event) => {
            if (marker) {
              geoJsonLayer.removeLayer(marker);
            }
            let value = feature.properties[mapTypeValue];
            marker = L.marker(event.latlng, {
              icon: L.divIcon({
                className: "hover-marker",
                html: `${feature.properties._id}: ${value.toLocaleString()} ${units}`
              })
            });
            geoJsonLayer.addLayer(marker);
          }
        });
      }
    }));
  });
});

Template.location.helpers({
  legendTitle: x => "Outbound " + typeToTitle[Template.instance().mapType.get()],
  legendRamp: () => OUTBOUND_RAMP,
  mapTypes: () => {
    const selectedType = Template.instance().mapType.get();
    return mapTypes.map((type) => {
      type.selected = type.name == selectedType;
      return type;
    });
  },
  selectedLocationName: () => {
    const selectedLocation = Template.instance().selectedLocation.get();
    if (selectedLocation) {
      return selectedLocation.displayName + (selectedLocation.type === "airport" ? " Airport" : "");
    }
  },
  layers: () => displayLayers
});

Template.location.events({
  'change #map-type': (event, instance) => {
    FlowRouter.setQueryParams({"mapType": event.target.value});
  }
});
