/* global L, chroma, FlowRouter */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import Constants from '/imports/constants';
import { _ } from 'meteor/underscore';

const RAMP = chroma.scale(["#ffffff", Constants.PRIMARY_COLOR]).colors(10);
const getColor = (val) => {
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.map.onCreated(function() {
  this.mapType = new ReactiveVar("threatLevel");
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY),
    end: endDate
  };
  const selectedLocation = this.selectedLocation = new ReactiveVar();
});

Template.map.onRendered(function() {
  let marker = null;
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = L.layerGroup([]).addTo(map);
  const renderGeoJSON = (mapData, units = "") => {
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    geoJsonLayer.clearLayers();
    geoJsonLayer.addLayer(L.geoJson(WorldGeoJSON, {
      style: (feature) => {
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
          weight: 1,
          color: '#DDDDDD',
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
  const mapType = this.mapType;
  locationGeoJsonPromise.then((locations) => {
    this.autorun(() => {
      const locationId = FlowRouter.getParam('locationId');
      const location = locations[locationId];
      this.selectedLocation.set({
        type: locationId.startsWith("airport") ? "airport" : "state",
        displayName: location.displayName
      });
      let route, valueProp, units;
      const mapTypeValue = mapType.get();
      if (!location) return;
      if (mapTypeValue === "passengerFlow") {
        route = "passengerFlows";
        valueProp = "estimatedPassengers";
        units = "passengers per day";
      } else if (mapTypeValue === "threatLevel") {
        route = "threatLevel";
        valueProp = "rank";
        units = "rank score";
      } else {
        route = "inboundTraffic";
        valueProp = "numSeats";
        units = "seats per day";
      }
      HTTP.get(`/api/locations/${locationId}/${route}`, {
        // params: {
        //   arrivesBefore: "2017-10-10"
        // }
      }, (err, resp) => {
        if (err) return console.error(err);
        let result = {};
        const countryGroups = resp.data.countryGroups
        for (let id in countryGroups) {
          result[id] = countryGroups[id][valueProp];
        }
        renderGeoJSON(result, valueProp, units);
        geoJsonLayer.addLayer(L.geoJson({ features: locations[locationId].displayGeoJSON }));

        let maxValue = _.max(resp.data.allAirports.map((x) => x[valueProp]));
        geoJsonLayer.addLayer(L.geoJson({
          features: resp.data.allAirports.map((x)=>{
            const key = 'airport:' + x._id;
            if(!(key in locations)) return;
            return {
              "type": "Feature",
              "geometry": locations[key].displayGeoJSON[0],
              "properties": x
            }
          }).filter(x=>x)
        }, {
          pointToLayer: function (feature, latlng) {
            let value = feature.properties[valueProp];
            return L.circleMarker(latlng, {
              // The radius is a squre root so that the marker's volume is directly
              // proprotional to the value.
              radius: Math.sqrt(2 + (value / maxValue) * 144),
              weight: 0,
              opacity: 1
            });
          },
          style: (feature) => {
            let value = feature.properties[valueProp];
            return {
              fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
              weight: 1,
              color: '#DDDDDD',
              fillOpacity: 1
            };
          },
          onEachFeature: (feature, layer) => {
            layer.on('mouseover', (event) => {
              if (marker) {
                geoJsonLayer.removeLayer(marker);
              }
              let value = feature.properties[valueProp];
              marker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: `${feature.properties._id}: ${value.toLocaleString()} ${units}`
                })
              });
              geoJsonLayer.addLayer(marker);
            });
          }
        }));
      });
    });
  });
});

Template.map.helpers({
  dateRange: () => Template.instance().dateRange,
  mapTypes: () => {
    const selectedType = Template.instance().mapType.get();
    return [
      { name: "directSeats", label: "Direct Seats by Origin Map" },
      { name: "passengerFlow", label: "Estimated Passenger Flow by Origin Map" },
      { name: "threatLevel", label: "Threat Level by Origin Map" }
    ].map((type) => {
      type.selected = type.name == selectedType;
      return type;
    });
  },
  selectedLocationName: () => {
    const selectedLocation = Template.instance().selectedLocation.get();
    if (selectedLocation) {
      return selectedLocation.displayName + (selectedLocation.type === "airport" ? " Airport" : "");
    }
  }
});

Template.map.events({
  'change #map-type': (event, instance) => {
    instance.mapType.set(event.target.value);
  }
});
