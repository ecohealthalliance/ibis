/* global L, FlowRouter, $ */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import Constants from '/imports/constants';
import { INBOUND_RAMP, OUTBOUND_RAMP, INBOUND_LINE, OUTBOUND_LINE, getColor } from '/imports/ramps';
import { _ } from 'meteor/underscore';
import typeToTitle from '/imports/typeToTitle';
import displayLayers from '/imports/displayLayers';
import { airportCutoffPercentage } from '/imports/configuration';

const mapTypes = [
  { name: "originThreatLevel", label: "Threat Level by Origin" },
  { name: "originProbabilityPassengerInfected", label: "Estimated Probability Passenger Infected by Origin" },
  { name: "destinationThreatExposure", label: "Threat Exposure by Destination" },
  { name: "topOrigins", label: "Top Origins" },
  { name: "topDestinations", label: "Top Destinations" }
];

const getRamp = (mapType)=>{
  if(mapType.startsWith('origin') || mapType.endsWith('Origins')) {
    return OUTBOUND_RAMP;
  } else {
    return INBOUND_RAMP;
  }
};

const getLine = (mapType)=>{
  if(mapType.startsWith('origin') || mapType.endsWith('Origins')) {
    return OUTBOUND_LINE;
  } else {
    return INBOUND_LINE;
  }
};

Template.bioevent.onCreated(function() {
  this.ramp = OUTBOUND_RAMP;
  this.line = OUTBOUND_LINE;
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
      const locations = _.map(locationGeoJson, (location, locationId)=>{
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
          location.USAirport = USAirportIds.indexOf(locationName) >= 0;
        }
        return location;
      });
      const airportLocations = locations.filter(x=>x.type === "airport");
      _.sortBy(airportLocations, (loc)=>{
        return -loc.destinationThreatExposure;
      }).map((x, idx)=>{
        x.globalDestRank = idx + 1;
        return x;
      }).filter((loc)=>loc.USAirport).map((x, idx)=>{
        x.USDestRank = idx + 1;
        return x;
      });
      _.sortBy(airportLocations, (loc)=>{
        return -loc.originThreatLevel;
      }).map((x, idx)=>{
        x.globalOriginRank = idx + 1;
        return x;
      });
      this.locations.set(locations);
    });
  });
  const endDate = new Date();
  this.dateRange = {
    start: new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY),
    end: endDate
  };
});

Template.bioevent.onRendered(function() {
  this.$('.show-origins').css({color: OUTBOUND_LINE});
  this.$('.show-destinations').css({color: INBOUND_LINE});
  const map = L.map('map', Constants.LEAFLET_MAP_CONFIG);
  map.setView(Constants.INITIAL_MAP_VIEW, 4);
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
          fillColor: value ? getColor(value / maxValue, this.ramp) : '#FFFFFF',
          weight: 1,
          color: this.line,
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
    this.ramp = getRamp(mapType);
    this.line = getLine(mapType);
    const displayLayersVal = displayLayers.get();
    const showBubbles = _.findWhere(displayLayersVal, {
      name: 'bubbles'
    }).active;
    const showChoropleth = _.findWhere(displayLayersVal, {
      name: 'choropleth'
    }).active;
    const countryValues = this.countryValues.get();
    const countryValuesForType = countryValues ? countryValues[mapType] : {};
    renderGeoJSON(showChoropleth ? countryValuesForType || {} : {});
    let layers = [];
    let locations = this.locations.get();
    let airportMax = 0;
    let stateMax = 0;
    const USOnly = Template.instance().USOnly.get();
    const values = {};
    locations.forEach((location)=>{
      if(mapType === 'topDestinations') {
        if(USOnly) {
          values[location._id] = location.USDestRank <= 10 ? 11 - location.USDestRank : 0;
        } else {
          values[location._id] = location.globalDestRank <= 10 ? 11 - location.globalDestRank : 0;
        }
      } else if( mapType === 'topOrigins') {
        values[location._id] = location.globalOriginRank <= 10 ? 11 - location.globalOriginRank : 0;
      } else {
        values[location._id] = location[mapType];
      }
    });
    locations.map((location)=>{
      let value = values[location._id];
      if(location.type === 'state' && value > stateMax) stateMax = value;
      if(location.type === 'airport' && value > airportMax) airportMax = value;
    });
    const airportCutoffMultiple = 0.01 * airportCutoffPercentage.get();
    _.sortBy(locations, (x)=>x.type == 'airport').forEach((location)=>{
      if(!showBubbles && location.type == 'airport') return;
      if(!location.displayGeoJSON) return;
      if(location.type == 'airport' && !values[location._id]) return;
      const value = values[location._id];
      if(value < (airportCutoffMultiple * airportMax) && location.type == 'airport') return;
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
            fillColor: value && (location.type === 'airport' || showChoropleth) ? getColor(value / maxValue, this.ramp) : '#FFFFFF',
            weight: 1,
            color: this.line,
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              const popupElement = $('<div>').get(0);
              let properties = [
                { name: "originThreatLevel", label: "Threat Level Posed" },
                { name: "originProbabilityPassengerInfected", label: "Estimated Probability Passenger Infected" },
                { name: "destinationThreatExposure", label: "Threat Exposure" }
              ].map((t)=>{
                return {
                  value: location[t.name],
                  label: t.label
                };
              });
              if(location.type === 'airport') {
                properties = properties.concat([{
                  label: "Threat Level Global Rank",
                  value: "" + location["globalOriginRank"]
                }, {
                  label: "Threat Exposure Global Rank",
                  value: "" + location["globalDestRank"]
                }]);
                if(location["USDestRank"]){
                  properties.push({
                    label: "Threat Exposure US Rank",
                    value: "" + location["USDestRank"]
                  });
                }
              }
              Blaze.renderWithData(Template.locationPopup, {
                location: location,
                properties: properties
              }, popupElement);
              layer.bindPopup(popupElement)
                .openPopup()
                .unbindPopup();
            },
            mouseover: (event)=>{
              if(hoverMarker) {
                map.removeLayer(hoverMarker);
              }
              hoverMarker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: location.displayName + (_.isNumber(value) ? ": " + value.toPrecision(2) : "")
                })
              }).addTo(map);
              layer.setStyle({
                weight: 2,
                color: this.line,
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
  legendTitle: ()=>typeToTitle[Template.instance().mapType.get()],
  legendRamp: ()=>getRamp(Template.instance().mapType.get()),
  USOnly: ()=>Template.instance().USOnly.get(),
  topDestinations: ()=>{
    const USOnly = Template.instance().USOnly.get();
    return _.chain(Template.instance().locations.get())
      .filter(x=>(USOnly ? x.USDestRank : x.globalDestRank) <= 10)
      .map((loc)=>{
        const [type, codeName] = loc._id.split(':');
        return {
          name: `${loc.displayName} (${codeName})`,
          value: loc.destinationThreatExposure,
          USDestRank: loc.USDestRank,
          globalDestRank: loc.globalDestRank,
          link: `/locations/${loc._id}`
        };
      }).sortBy(x=>-x.value).value();
  },
  topOrigins: ()=>{
    return _.chain(Template.instance().locations.get())
      .filter(x=>x.globalOriginRank <= 10)
      .map((loc)=>{
        const [type, codeName] = loc._id.split(':');
        return {
          name: `${loc.displayName} (${codeName})`,
          value: loc.originThreatLevel,
          link: `/locations/${loc._id}`
        };
      }).sortBy(x=>-x.value).value();
  },
  dateRange: ()=>Template.instance().dateRange,
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return mapTypes.map((type)=>{
      type.selected = type.name == selectedType;
      return type;
    });
  },
  mapType: ()=> Template.instance().mapType,
  showingTopOrigins: ()=>Template.instance().mapType.get() == 'topOrigins',
  showingTopDestinations: ()=>Template.instance().mapType.get() == 'topDestinations',
  resolvedBioevent: ()=>{
    return Template.instance().resolvedBioevent.get();
  },
  layers: ()=>displayLayers
});

Template.bioevent.events({
  'change #map-type': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": event.target.value});
  },
  'click .us-only-checkbox': (event, instance)=>{
    instance.USOnly.set(!instance.USOnly.get());
  },
  'click .show-origins': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": 'topOrigins'});
  },
  'click .show-destinations': (event, instance)=>{
    FlowRouter.setQueryParams({"mapType": 'topDestinations'});
  }
});
