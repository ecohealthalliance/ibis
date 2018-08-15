/* global L, FlowRouter */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import Constants from '/imports/constants';
import { INBOUND_RAMP, OUTBOUND_RAMP, getColor } from '/imports/ramps';
import { _ } from 'meteor/underscore';
import typeToTitle from '/imports/typeToTitle';

Template.bioevent.onCreated(function() {
  this.ramp = OUTBOUND_RAMP;
  this.mapType = new ReactiveVar();
  this.autorun(()=>{
    this.mapType.set(FlowRouter.getQueryParam("mapType") || "destinationThreatExposure");
  });
  this.USOnly = new ReactiveVar(true);
  this.locations = new ReactiveVar([]);
  this.resolvedBioevent = new ReactiveVar();
  this.countryValues = new ReactiveVar();
  this.autorun(()=>{
    const bioeventId = FlowRouter.getParam('bioeventId');
    const metric = this.mapType.get();
    Promise.all([
      new Promise((resolve, reject) =>{
        HTTP.get('/api/bioevents/' + bioeventId, (err, resp)=> {
          if(err) return reject(err);
          resolve(resp.data);
        });
      }), locationGeoJsonPromise
    ]).then(([bioeventData, locationGeoJson])=>{
      const airportValues = bioeventData.airportValues;
      const USAirportIds = bioeventData.USAirportIds;
      this.countryValues.set(bioeventData.countryValues);
      this.resolvedBioevent.set(bioeventData.resolvedBioevent);
      this.locations.set(_.map(locationGeoJson, (location, locationId)=>{
        let locationName;
        location = Object.create(location);
        ["destinationThreatExposure", "originThreatLevel", "originProbabilityPassengerInfected"].forEach((metric)=>{
          location[metric] = 0;
          location.airportIds.forEach((airportId)=>{
            location[metric] += airportValues[metric][airportId] || 0;
          });
        });
        location._id = locationId;
        [location.type, locationName] = locationId.split(':');
        if(location.type == "airport") {
          location.USAirport = USAirportIds.indexOf(locationName) >= 0
        }
        return location;
      }));
    });
  });
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY),
    end: endDate
  };
});

Template.bioevent.onRendered(function() {
  const map = L.map('map');
  map.setView([40.077946, -95.989253], 4);
  let geoJsonLayer = null;
  let hoverMarker = null;
  const renderGeoJSON = (mapData, units="")=>{
    const maxValue = _.max(_.values(_.omit(mapData, "US")));
    if(geoJsonLayer){
      map.removeLayer(geoJsonLayer);
    }
    geoJsonLayer = L.layerGroup([L.geoJson(WorldGeoJSON, {
      style: (feature)=>{
        let value = mapData[feature.properties.iso_a2];
        return {
          fillColor: value ? getColor(0.8 * value / maxValue, this.ramp) : '#FFFFFF',
          weight: 1,
          color: this.ramp[9],
          // Hide the US since it will be shown in the states layer.
          fillOpacity: feature.properties.iso_a2 == 'US' ? 0.0 : 1.0
        };
      },
      onEachFeature: (feature, layer)=>{
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
  
  let locationLayer = null;
  this.autorun(()=>{
    const mapType = this.mapType.get();
    if(mapType == "destinationThreatExposure") {
      this.ramp = INBOUND_RAMP;
    } else {
      this.ramp = OUTBOUND_RAMP;
    }
    const countryValues = this.countryValues.get();
    const countryValuesForType = countryValues ? countryValues[mapType] : {};
    renderGeoJSON(countryValuesForType || {});
    let layers = [];
    let locations = this.locations.get();
    let airportMax = 0;
    let stateMax = 0;
    locations.map((location)=>{
      let value = location[mapType];
      if(location.type === 'state' && value > stateMax) stateMax = value;
      if(location.type === 'airport' && value > airportMax) airportMax = value;
    });
    locations.forEach((location)=>{
      if(!location.displayGeoJSON) return;
      if(location.type == 'airport' && !location[mapType]) return;
      const value = location[mapType];
      var geojsonMarkerOptions = {
        // The radius is a squre root so that the marker's volume is directly
        // proprotional to the value.
        radius: Math.sqrt(2 + 144 * value / airportMax),
        weight: 0,
        opacity: 1
      };
      const marker = L.geoJson({features: location.displayGeoJSON}, {
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
        style: (feature)=>{
          let maxValue = location.type === 'airport' ? airportMax : stateMax;
          return {
            fillColor: value ? getColor(0.8 * value / maxValue, this.ramp) : '#FFFFFF',
            weight: 1,
            color: this.ramp[9],
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              FlowRouter.go('/locations/:locationId', {locationId: location._id});
            },
            mouseover: (event)=>{
              if(hoverMarker) {
                map.removeLayer(hoverMarker);
              }
              hoverMarker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: location.displayName + ": " + value.toPrecision(2)
                })
              }).addTo(map);
              layer.setStyle({
                weight: 2,
                color: Constants.PRIMARY_COLOR
              });
              window.setTimeout(()=>{
                marker.resetStyle(layer);
              }, 300);
            }
          });
        }
      });
      layers.push(marker);
    });
    if(locationLayer) {
      map.removeLayer(locationLayer);
    }
    locationLayer = new L.layerGroup(layers).addTo(map);
  });
});

Template.bioevent.helpers({
  legendTitle: () => typeToTitle[Template.instance().mapType.get()],
  legendRamp: () => (Template.instance().mapType.get() || "").startsWith("origin") ? OUTBOUND_RAMP : INBOUND_RAMP,
  toFixed: (x, y) => x ? x.toFixed(y) : x,
  USOnly: () => Template.instance().USOnly.get(),
  topDestinations: () => {
    const USOnly = Template.instance().USOnly.get();
    return _.sortBy(Template.instance().locations.get().map((loc)=>{
      let type, name;
      [type, name] = loc._id.split(':');
      if(type != "airport") return;
      if(USOnly && !loc.USAirport) return;
      return {
        name: name,
        value: loc.destinationThreatExposure
      };
    }).filter(x=>x), x=>-x.value).slice(0, 10);
  },
  topOrigins: () => {
    const USOnly = Template.instance().USOnly.get();
    return _.sortBy(Template.instance().locations.get().map((loc)=>{
      let type, name;
      [type, name] = loc._id.split(':');
      if(type != "airport") return;
      return {
        name: name,
        value: loc.originThreatLevel
      };
    }).filter(x=>x), x=>-x.value).slice(0, 10);
  },
  dateRange: () => Template.instance().dateRange,
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return [
      { name: "originThreatLevel", label: "Threat Level by Origin Map" },
      { name: "originProbabilityPassengerInfected", label: "Estimated Probability Passenger Infected by Origin" },
      { name: "destinationThreatExposure", label: "Threat Exposure by Destination Map" }
    ].map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  },
  resolvedBioevent: ()=>{
    return Template.instance().resolvedBioevent.get()
  }
});

Template.bioevent.events({
  'change #map-type': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": event.target.value})
  },
  'click .us-only-checkbox': (event, instance)=>{
    instance.USOnly.set(!instance.USOnly.get())
  }
});
