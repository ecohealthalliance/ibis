/* global L, $ */
import { FlowRouter } from 'meteor/kadira:flow-router';
import { ReactiveVar } from 'meteor/reactive-var';
import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import {
  INBOUND_RAMP,
  OUTBOUND_RAMP,
  INBOUND_LINE,
  OUTBOUND_LINE,
  getColor,
  getRamp,
  getLineColor } from '/imports/ramps';
import { _ } from 'meteor/underscore';
import typeToTitle from '/imports/typeToTitle';
import displayLayers from '/imports/displayLayers';
import {
  airportCutoffPercentage,
  defaultBioeventMapType } from '/imports/configuration';
import {
  bioeventMapTypes,
  LEAFLET_MAP_CONFIG,
  DATA_INTERVAL_DAYS,
  MILLIS_PER_DAY,
  INITIAL_MAP_VIEW } from '/imports/constants';
import loadingIndicator from '/imports/loadingIndicator';
import { HTTPAuthenticatedGet, formatNumber } from '/imports/utils';
import { renderAllCountryGeoJSONLayer } from '/imports/leafletUtils';
import foresightAirports from '/imports/foresightAirports';

const foresightBioevents = {
  //Chikungunya
  "qg8ZYWwrqNGrm3ZCn": {
    modelId: 1
  },
  //Zika
  "MeQecSXhFFerkdgw2": {
    modelId: 2
  },
  //Dengue
  "TRybDhcEFfQHnBLBY": {
    modelId: 6
  },
  //DHF
  "b94hEgeXH3vSuF6r3": {
    modelId: 6
  }
};

Template.bioevent.onCreated(function() {
  this.airportType = new ReactiveVar("all");
  this.mapType = new ReactiveVar();
  this.autorun(()=>{
    this.mapType.set(FlowRouter.getQueryParam("mapType") || defaultBioeventMapType.get());
  });
  this.USOnly = new ReactiveVar(true);
  this.locations = new ReactiveVar([]);
  this.resolvedBioevent = new ReactiveVar();
  this.countryValues = new ReactiveVar();
  const endDate = new Date();
  this.dateRange = new ReactiveVar({
    start: new Date(endDate - DATA_INTERVAL_DAYS * MILLIS_PER_DAY),
    end: endDate
  });
  this.autorun(()=>{
    const bioeventId = FlowRouter.getParam('bioeventId');
    const loadingIndicatorSemaphore = loadingIndicator.show();
    Promise.all([
      HTTPAuthenticatedGet('/api/bioevents/' + bioeventId, {
        params: {
          rankGroup: FlowRouter.getQueryParam('rankGroup') || null
        }
      }), locationGeoJsonPromise
    ])
    .finally(()=>loadingIndicator.hide(loadingIndicatorSemaphore))
    .then(([bioeventResp, locationGeoJson])=>{
      const bioeventData = bioeventResp.data;
      const airportValues = bioeventData.airportValues;
      this.countryValues.set(bioeventData.countryValues);
      this.resolvedBioevent.set(bioeventData.resolvedBioevent);
      let endDate = new Date(bioeventData.resolvedBioevent.timeseries.slice(-1)[0][0]);
      this.dateRange.set({
        start: new Date(endDate - DATA_INTERVAL_DAYS * MILLIS_PER_DAY),
        end: endDate
      });
      // Create copies of the objects from locationGeoJson annotated with combined
      // values of their associated airports.
      const locations = _.map(locationGeoJson, (location, locationId)=>{
        let locationName;
        location = Object.create(location);
        [
          "threatLevelExposure",
          "threatLevelExposureExUS",
          "originThreatLevel",
          "originProbabilityPassengerInfected",
          "infectionsInOriginCatchment"
        ].forEach((metric)=>{
          location[metric] = 0;
          location.airportIds.forEach((airportId)=>{
            location[metric] += airportValues[metric][airportId] || 0;
          });
        });
        location._id = locationId;
        [location.type, locationName] = locationId.split(':');
        return location;
      });
      const totalOriginThreatLevel = locations.reduce((sofar, cur)=> sofar + cur.originThreatLevel, 0);
      locations.forEach((location)=> {
        location.originThreatLevelPercent = 100 * location.originThreatLevel / totalOriginThreatLevel;
      });
      const totalThreatLevelExposure = locations.reduce((sofar, cur)=> sofar + cur.threatLevelExposure, 0);
      locations.forEach((location)=> {
        location.threatLevelExposurePercent = 100 * location.threatLevelExposure / totalThreatLevelExposure;
      });
      this.locations.set(locations);
    });
  });
});

Template.bioevent.onRendered(function() {
  const map = L.map('map', LEAFLET_MAP_CONFIG);
  map.setView(INITIAL_MAP_VIEW, 4);
  let locationLayer = null;
  this.autorun(()=>{
    const mapType = this.mapType.get();
    const ramp = getRamp(mapType);
    const lineColor = getLineColor(mapType);
    const displayLayersVal = displayLayers.get();
    const showBubbles = _.findWhere(displayLayersVal, {
      name: 'bubbles'
    }).active;
    const showChoropleth = _.findWhere(displayLayersVal, {
      name: 'choropleth'
    }).active;
    const countryValues = this.countryValues.get();
    const countryValuesForType = countryValues ? countryValues[mapType] : {};
    let locationMarkers = [];
    let locations = this.locations.get();
    const airportTypeVal = this.airportType.get();
    if(airportTypeVal == "international") {
      locations = locations.filter(x=>x.type != 'airport' || !x.inUS);
    } else if(airportTypeVal == "domestic") {
      locations = locations.filter(x=>x.type != 'airport' || x.inUS);
    }
    const airportLocations = locations.filter(x=>x.type === "airport");
    _.sortBy(airportLocations, (loc)=>{
      return -loc.threatLevelExposure;
    }).map((x, idx)=>{
      x.globalDestRank = idx + 1;
      return x;
    }).filter((loc)=>loc.inUS).map((x, idx)=>{
      x.USDestRank = idx + 1;
      return x;
    });
    _.sortBy(airportLocations, (loc)=>{
      return -loc.originThreatLevel;
    }).map((x, idx)=>{
      x.globalOriginRank = idx + 1;
      return x;
    });
    const USOnly = Template.instance().USOnly.get();
    const values = {};
    locations.forEach((location)=>{
      if(mapType === 'topDestinations') {
        if(USOnly) {
          values[location._id] = location.USDestRank <= 10 ? location.threatLevelExposure : 0;
        } else {
          values[location._id] = location.globalDestRank <= 10 ? location.threatLevelExposure : 0;
        }
      } else if( mapType === 'topOrigins') {
        values[location._id] = location.globalOriginRank <= 10 ? location.originThreatLevel : 0;
      } else {
        values[location._id] = location[mapType];
      }
    });
    let airportMax = 0;
    let stateMax = _.max(_.values(_.omit(countryValuesForType, "US")));
    locations.map((location)=>{
      let value = values[location._id];
      if(location.type === 'state' && value > stateMax) stateMax = value;
      if(location.type === 'airport' && value > airportMax) airportMax = value;
    });
    renderAllCountryGeoJSONLayer(
      map,
      showChoropleth ? countryValuesForType || {} : {},
      stateMax,
      ramp,
      lineColor
    );
    const airportCutoffMultiple = mapType.startsWith('top') ? 0 : 0.01 * airportCutoffPercentage.get();
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
            fillColor: value && (location.type === 'airport' || showChoropleth) ? getColor(value / maxValue, ramp) : '#FFFFFF',
            weight: 1,
            color: lineColor,
            fillOpacity: 1.0
          };
        },
        onEachFeature: (feature, layer)=>{
          layer.on({
            click: (event)=>{
              const popupElement = $('<div>').get(0);
              let properties = [
                { name: "originThreatLevel" },
                { name: "originProbabilityPassengerInfected" },
                { name: "threatLevelExposure" }
              ].map((t)=>{
                return {
                  value: location[t.name],
                  label: typeToTitle[t.name]
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
              const now = new Date();
              let foresightJSON = null;
              let foresightModelId = null;
              let foresightBioeventInfo = foresightBioevents[FlowRouter.getParam('bioeventId')];
              if(foresightBioeventInfo){
                foresightModelId = foresightBioeventInfo.modelId;
                let [type, airportId] = location._id.split(':');
                if(type == "airport" && foresightAirports.includes(airportId)) {
                  foresightJSON = JSON.stringify([{
                    airport: airportId,
                    infection: location['infectionsInOriginCatchment'],
                    day: Math.floor((now - new Date(now.toISOString().slice(0, 4))) / MILLIS_PER_DAY)
                  }]);
                }
              }
              Blaze.renderWithData(Template.locationPopup, {
                location: location,
                properties: properties,
                foresightJSON: foresightJSON,
                modelId: foresightModelId
              }, popupElement);
              layer.bindPopup(popupElement)
                .openPopup()
                .unbindPopup();
            },
            mouseover: (event)=>{
              if(map.hoverMarker) {
                map.removeLayer(map.hoverMarker);
              }
              map.hoverMarker = L.marker(event.latlng, {
                icon: L.divIcon({
                  className: "hover-marker",
                  html: location.displayName + (_.isNumber(value) ? ": " + formatNumber(value) : "")
                })
              }).addTo(map);
              layer.setStyle({
                weight: 2,
                color: lineColor,
              });
              window.setTimeout(()=>{
                marker.resetStyle(layer);
              }, 300);
            }
          });
        }
      });
      locationMarkers.push(marker);
    });
    if(locationLayer) {
      map.removeLayer(locationLayer);
    }
    locationLayer = new L.layerGroup(locationMarkers).addTo(map);
  });
});

Template.bioevent.helpers({
  hasForesightModel: ()=>foresightBioevents[FlowRouter.getParam('bioeventId')] != null,
  legendTitle: ()=>typeToTitle[Template.instance().mapType.get()],
  legendRamp: ()=>getRamp(Template.instance().mapType.get()),
  USOnly: ()=>Template.instance().USOnly.get(),
  topDestinations: ()=>{
    const USOnly = Template.instance().USOnly.get();
    return _.chain(Template.instance().locations.get())
      .filter(x=>(USOnly ? x.USDestRank : x.globalDestRank) <= 10 && x.threatLevelExposure > 0)
      .map((loc)=>{
        const [type, codeName] = loc._id.split(':');
        return {
          name: `${loc.displayName} (${codeName})`,
          value: loc.threatLevelExposurePercent,
          USDestRank: loc.USDestRank,
          globalDestRank: loc.globalDestRank,
          link: `/locations/${loc._id}`
        };
      }).sortBy(x=>-x.value).value();
  },
  topOrigins: ()=>{
    return _.chain(Template.instance().locations.get())
      .filter(x=>x.globalOriginRank <= 10 && x.originThreatLevel > 0)
      .map((loc)=>{
        const [type, codeName] = loc._id.split(':');
        return {
          name: `${loc.displayName} (${codeName})`,
          value: loc.originThreatLevelPercent,
          link: `/locations/${loc._id}`
        };
      }).sortBy(x=>-x.value).value();
  },
  dateRange: ()=>Template.instance().dateRange.get(),
  mapTypes: ()=>{
    const selectedType = Template.instance().mapType.get();
    return bioeventMapTypes.map((type)=>{
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
  layers: ()=>displayLayers,
  airportType: ()=>Template.instance().airportType
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
  },
  'click .create-foresight-sim.origins': (event, instance)=>{
    $('#foresight-sim-modal').modal('show');
    $('#foresight-sim-modal .content').replaceWith('<div class="content modal-body">');
    Blaze.renderWithData(Template.createForesightSimulation, {
      locations: instance.locations.get().map((location)=>{
        const airport = location._id.split(':')[1];
        if(foresightAirports.includes(airport)){
          return {
            airport: airport,
            fullAirportName: `${location.displayName} (${airport})`,
            value: location.originThreatLevel,
            globalPercent: location.originThreatLevelPercent
          };
        }
      }).filter(x=>x && x.value > 0),
      modelId: foresightBioevents[FlowRouter.getParam('bioeventId')].modelId
    }, $('#foresight-sim-modal .content')[0]);
  },
  'click .create-foresight-sim.destinations': (event, instance)=>{
    $('#foresight-sim-modal').modal('show');
    $('#foresight-sim-modal .content').replaceWith('<div class="content modal-body">');
    Blaze.renderWithData(Template.createForesightSimulation, {
      locations: instance.locations.get().map((location)=>{
        const airport = location._id.split(':')[1];
        if(foresightAirports.includes(airport)){
          return {
            airport: airport,
            fullAirportName: `${location.displayName} (${airport})`,
            value: location.threatLevelExposure,
            globalPercent: location.threatLevelExposurePercent
          };
        }
      }).filter(x=>x && x.value > 0),
      modelId: foresightBioevents[FlowRouter.getParam('bioeventId')].modelId
    }, $('#foresight-sim-modal .content')[0]);
  },
});
