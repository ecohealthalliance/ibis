/* global Restivus */
import { _ } from 'meteor/underscore';
import {
  Flights,
  PassengerFlows,
  EventAirportRanks,
  UserAirportRanks,
  ResolvedEvents,
  PastEventAirportRanks,
  PastResolvedEvents,
  Lemis
} from './FlightDB';
import locationData from '/server/locationData';
import { airportToCountryCode, USAirportIds } from '/imports/geoJSON/indecies';
import { Promise } from "meteor/promise";

const autoeventResp = HTTP.get('https://eidr-connect.eha.io/api/auto-events', {
  params: {
    limit: 20000,
    query: JSON.stringify({
      // "disease by infectious agent" and it's immediate sub-categories are
      // omitted because they are always ranked as top bioevents hiding
      // trends in specific diseases.
      "diseases.id": {
        $nin: [
          // parasitic infectious disease
          "http://purl.obolibrary.org/obo/DOID_1398",
          // fungal infectious disease
          "http://purl.obolibrary.org/obo/DOID_1564",
          // bacterial infectious disease
          "http://purl.obolibrary.org/obo/DOID_104",
          // viral infectious disease
          "http://purl.obolibrary.org/obo/DOID_934",
          "http://purl.obolibrary.org/obo/DOID_0050117"
        ]
      },
      $or: [{
        parentDiseases: [
          "http://purl.obolibrary.org/obo/DOID_934"
        ]
      }, {
        parentDiseases: [
          "http://purl.obolibrary.org/obo/DOID_104"
        ]
      }, {
        parentDiseases: [
          "http://purl.obolibrary.org/obo/DOID_1564"
        ]
      }, {
        parentDiseases: [
          "http://purl.obolibrary.org/obo/DOID_1398"
        ]
      }, {
        parentDiseases: null
      }]
    })
  }
});
// Only top level bioevents are summed over to determine location ranks
// to prevent threat from overlapping bioevents from being double counted.
const topLevelBioEvents = JSON.parse(autoeventResp.content).map(x=>x._id);

let api = new Restivus({
  useDefaultAuth: true,
  prettyJson: true
});

var aggregate = (collection, pipeline) => {
  return Promise.await(collection.aggregate(pipeline).toArray());
};

var clearCacheFunctions = [];
var clearCaches = ()=>clearCacheFunctions.forEach(x=>x());

var cached = function(func) {
  let cache = {};
  let cacheDate = {};
  // Track least recently used items in cache so they can be deleted if the cache
  // grows too large.
  let lru = [];
  let that = this;
  clearCacheFunctions.push(()=>{
    lru = [];
    cache = {};
    cacheDate = {};
  });
  return function(...args) {
    let strArgs = "" + args;
    if(strArgs in cache) {
      let cacheExpireDate = new Date(cacheDate[strArgs]);
      cacheExpireDate.setHours(cacheExpireDate.getHours() + 5);
      if(new Date() < cacheExpireDate) {
        return cache[strArgs];
      }
    }
    let result = func.call(that, ...args);
    cache[strArgs] = result;
    cacheDate[strArgs] = new Date();
    lru = _.without(lru, strArgs);
    lru.push(strArgs);
    if(lru.length > 10) {
      delete cache[lru[0]];
      delete cacheDate[lru[0]];
      lru = lru.slice(1);
    }
    return result;
  };
};

var topLocations = cached((metric, bioeventId)=>{
  if(metric.startsWith("threatLevelExposure")) {
    const exUS = metric.endsWith("ExUS");
    let matchQuery = {
      departureAirportId: {
        $nin: exUS ? USAirportIds : []
      }
    };
    if(bioeventId) {
      matchQuery.eventId = bioeventId;
    } else {
      matchQuery.eventId = {
        $in: topLevelBioEvents
      };
    }
    let arrivalAirportToRankScore = _.object(aggregate(EventAirportRanks, [{
      $match: matchQuery
    }, {
      $group: {
        _id: "$arrivalAirportId",
        rank: {
          $sum: "$rank"
        }
      }
    }]).map((x)=> [x._id, x.rank]));
    return {
      airportValues: arrivalAirportToRankScore
    };
  } else if(metric === "passengerFlow") {
    // Only return locations with incoming passengers
    let arrivalAirportToPassengers = _.object(aggregate(PassengerFlows, [{
      $match: {
        simGroup: 'ibis14day'
      }
    }, {
      $group: {
        _id: "$arrivalAirport",
        totalPassengers: { $sum: "$estimatedPassengers" }
      }
    }]).map((x)=> [x._id, x.totalPassengers]));
    return {
      airportValues: arrivalAirportToPassengers
    };
  } else {
    return {
      statusCode: 404,
      body: 'Unknown metric'
    };
  }
});

var rankedBioevents = cached((metric, locationId=null, rankGroup=null)=>{
  if(!metric) {
    return {
      statusCode: 404,
      body: 'Unspecified metric.'
    };
  }
  const exUS = metric.endsWith("ExUS");
  const mostRecent = metric == "mostRecent";
  const activeCases = metric == "activeCases";
  let resolvedEventsCollection = ResolvedEvents;
  let eventAirportRanksCollection = EventAirportRanks;
  let query = {};
  if(rankGroup) {
    resolvedEventsCollection = PastResolvedEvents;
    eventAirportRanksCollection = PastEventAirportRanks;
    query.rankGroup = rankGroup;
  }
  if(mostRecent) {
    query._id = {
      $in: topLevelBioEvents
    };
    return {
      results: _.sortBy(resolvedEventsCollection.find(query, {fullLocations: -1}).map((event)=>{
        event.name = event.name.replace("Human ", "");
        return {
          _id: event._id,
          event: event,
          threatCoefficient: event.threatCoefficient,
          lastIncident: _.chain(event.dailyRateTimeseries || [])
            .map((x) => new Date(x[0]))
            .max()
            .value()
        };
      }), (event) => event.lastIncident).slice(-80).reverse()
    };
  } else if(activeCases) {
    query._id = {
      $in: topLevelBioEvents
    };
    return {
      results: _.sortBy(resolvedEventsCollection.find(query, {
        fullLocations: -1
      }).map((event)=>{
        event.name = event.name.replace("Human ", "");
        return {
          _id: event._id,
          event: event,
          threatCoefficient: event.threatCoefficient,
          activeCases: _.last(event.timeseries)[1]
        };
      }), (event) => event.activeCases).slice(-80).reverse()
    };
  } else {
    query.departureAirportId = {
      $nin: exUS ? USAirportIds : []
    };
    if(locationId) {
      const location = locationData.locations[locationId];
      if(!location) return {
        statusCode: 400,
        body: 'Location not found'
      };
      query.arrivalAirportId = {
        $in: location.airportIds
      };
    } else {
      query.arrivalAirportId = {
        $in: USAirportIds
      };
    }
    query.eventId = {
      $in: topLevelBioEvents
    };
    const results = aggregate(eventAirportRanksCollection, [{
      $match: query
    }, {
      $group: {
        _id: "$eventId",
        rank: {
          $sum: "$rank"
        },
        threatCoefficient: {
          $first: "$threatCoefficient"
        }
      }
    }, {
      $sort: {
        rank: -1
      }
    }, {
      $limit: 80
    }, {
      $lookup: {
        from: rankGroup ? "pastResolvedEvents" : "resolvedEvents",
        localField: "_id",
        foreignField: "eventId",
        as: "event"
      }
    }, {
      $unwind: "$event"
    }, {
      $match: rankGroup ? {
        "event.rankGroup": rankGroup
      } : {}
    }]);
    return {
      results: results.map((x)=>{
        x.event.name = x.event.name.replace("Human ", "");
        delete x.event.fullLocations;
        return x;
      })
    };
  }
});

var precacheFrequentValues = ()=>{
  ['threatLevelExposure', 'threatLevelExposureExUS', 'passengerFlow'].map((metric)=>{
    topLocations(metric, null);
  });
  rankedBioevents('threatLevel', null, null);
  rankedBioevents('threatLevelExUS', null, null);
};
precacheFrequentValues();
// Periodically run this to prevent the caches from holding expired values.
setInterval(precacheFrequentValues, 1000 * 60 * 60);

/*
@api {get} topLocations
@apiName topLocations
@apiGroup locations
*/
api.addRoute('topLocations', {
  authRequired: true
}, {
  get: function() {
    if(this.queryParams && this.queryParams.metric){
      return topLocations(this.queryParams.metric, this.queryParams.bioeventId || null);
    } else {
      return {
        statusCode: 400,
        body: 'A metric query parameter is required.'
      };
    }
  }
});

api.addRoute('locationGeoJson', {
  get: function() {
    return locationData.locations;
  }
});

/*
@api {get} locations/:locationId/inboundFlights Get inbound flights for the given location
@apiName inboundFlights
@apiGroup locations
@apiParam {ISODateString} arrivesAfter
@apiParam {ISODateString} arrivesBefore
*/
api.addRoute('locations/:locationId/inboundFlights', {
  authRequired: true
}, {
  get: function() {
    var location = locationData.locations[this.urlParams.locationId];
    var arrivesBefore = new Date(this.queryParams.arrivesBefore || new Date());
    return Flights.find({
      'arrivalAirport': {
        $in: location.airportIds
      },
      $and: [
        {
          arrivalDateTime: {
            $lte: arrivesBefore
          }
        }, {
          arrivalDateTime: {
            $gte: new Date(this.queryParams.arrivesAfter || new Date(arrivesBefore - 1000000000))
          }
        }
      ]
    }).fetch();
  }
});

/*
@api {get} locations/:locationId/directSeats Get inbound traffic stats
@apiName directSeats
@apiGroup locations
@apiParam {ISODateString} arrivesAfter
@apiParam {ISODateString} arrivesBefore
*/
api.addRoute('locations/:locationId/directSeats', {
  authRequired: true
}, {
  get: function() {
    const location = locationData.locations[this.urlParams.locationId];
    const arrivesBefore = new Date(this.queryParams.arrivesBefore || new Date());
    const arrivesAfter = new Date(this.queryParams.arrivesAfter || new Date(arrivesBefore - 1000000000));
    const MILLIS_PER_DAY = 1000 * 60 * 60  * 24;
    const periodDays = (Number(arrivesBefore) - Number(arrivesAfter)) / MILLIS_PER_DAY;
    const results = aggregate(Flights, [
      {
        $match: {
          'arrivalAirport': {
            $in: location.airportIds
          },
          $and: [
            {
              arrivalDateTime: {
                $lte: arrivesBefore
              }
            }, {
              arrivalDateTime: {
                $gte: arrivesAfter
              }
            }
          ]
        }
      }, {
        $group: {
          _id: "$departureAirport",
          directFlights: {
            $sum: 1
          },
          directSeats: {
            $sum: "$totalSeats"
          }
        }
      }
    ]);
    let statsByCountry = {};
    results.forEach((airportStats)=>{
      const country = airportToCountryCode[airportStats._id];
      const sofar = statsByCountry[country] || {
        directFlights: 0,
        directSeats: 0
      };
      sofar.directFlights += airportStats.directFlights / periodDays;
      sofar.directSeats += airportStats.directSeats / periodDays;
      statsByCountry[country] = sofar;
    });
    return {
      countryGroups: statsByCountry,
      allAirports: results
    };
  }
});

/*
@api {get} locations/:locationId/passengerFlow Get estimates of the
  total number of passengers arriving from each country.
@apiName passengerFlow
@apiGroup locations
*/
api.addRoute('locations/:locationId/passengerFlow', {
  authRequired: true
}, {
  get: function() {
    const location = locationData.locations[this.urlParams.locationId];
    const periodDays = 14;
    const results = aggregate(PassengerFlows, [{
      $match: {
        simGroup: 'ibis14day',
        arrivalAirport: {
          $in: location.airportIds
        }
      }
    }, {
      $group: {
        _id: "$departureAirport",
        passengerFlow: {
          $sum: "$estimatedPassengers"
        }
      }
    }]);
    let statsByCountry = {};
    results.forEach((result)=> {
      const country = airportToCountryCode[result._id];
      const sofar = statsByCountry[country] || {
        passengerFlow: 0
      };
      sofar.passengerFlow += result.passengerFlow / periodDays;
      statsByCountry[country] = sofar;
    });
    return {
      countryGroups: statsByCountry,
      allAirports: results.filter((x)=>x.passengerFlow >= 1)
    };
  }
});

/*
@api {get} locations/:locationId/threatLevel
@apiName threatLevel
@apiGroup locations
*/
api.addRoute('locations/:locationId/threatLevel', {
  authRequired: true
}, {
  get: function() {
    const location = locationData.locations[this.urlParams.locationId];
    const bioeventId = (this.queryParams || {}).bioeventId;
    let matchQuery = {
      arrivalAirportId: {
        $in: location.airportIds
      }
    };
    if(bioeventId) {
      matchQuery.eventId = bioeventId;
    } else {
      matchQuery.eventId = {
        $in: topLevelBioEvents
      };
    }
    const results = aggregate(EventAirportRanks, [{
      $match: matchQuery
    }, {
      $group: {
        _id: "$departureAirportId",
        threatLevel: {
          $sum: "$rank"
        }
      }
    }]);
    let statsByCountry = {};
    results.forEach((result) => {
      const country = airportToCountryCode[result._id];
      const sofar = statsByCountry[country] || {
        threatLevel: 0
      };
      sofar.threatLevel += result.threatLevel;
      statsByCountry[country] = sofar;
    });
    return {
      countryGroups: statsByCountry,
      allAirports: results.filter((x)=>x.threatLevel >= 0.0000001)
    };
  }
});

/*
@api {get} locations/:locationId/threatLevelPosedByDisease
@apiName threatLevelPosedByDisease
*/
api.addRoute('locations/:locationId/threatLevelPosedByDisease', {
  authRequired: true
}, {
  get: function() {
    const location = locationData.locations[this.urlParams.locationId];
    const rankGroup = this.queryParams.rankGroup;
    const results = aggregate(EventAirportRanks, [{
      $match: {
        departureAirportId: {
          $in: location.airportIds
        },
        eventId: {
          $in: topLevelBioEvents
        }
      }
    }, {
      $group: {
        _id: "$eventId",
        threatLevel: {
          $sum: "$rank"
        }
      }
    }, {
      $lookup: {
        from: rankGroup ? "pastResolvedEvents" : "resolvedEvents",
        localField: "_id",
        foreignField: "eventId",
        as: "event"
      }
    }, {
      $unwind: "$event"
    }]);
    return results.map((x)=>{
      x.event.name = x.event.name.replace("Human ", "");
      return x;
    });
  }
});

/*
@api {get} locations/:locationId/bioevents Get a list of bioevents ranked by their relevance to the given location.
*/
api.addRoute('locations/:locationId/bioevents', {
  authRequired: true
}, {
  get: function() {
    let resp = _.clone(rankedBioevents(
      this.queryParams.metric,
      this.urlParams.locationId,
      rankGroup=this.queryParams.rankGroup));
    const minSeverity = parseFloat(this.queryParams.minDiseaseSeverity);
    resp.results = resp.results.filter((result)=>{
      if(!('threatCoefficient' in result)) return true;
      return result.threatCoefficient >= minSeverity;
    }).slice(0, 10);
    return resp;
  }
});

/*
@api {get} rankData Get all the rank data for the bioevent and optional location.
*/
api.addRoute('rankData', {
  authRequired: true
}, {
  get: function() {
    const exUS = this.queryParams.metric == "threatLevelExUS";
    var matchQuery = {
      departureAirportId: {
        $nin: exUS ? USAirportIds : []
      },
      eventId: this.queryParams.eventId,
      rank: {
        $gt: 0
      },
      arrivalAirportId: {
        $in: USAirportIds
      }
    };
    const rankGroup = this.queryParams.rankGroup;
    let eventAirportRanksCollection = EventAirportRanks;
    if(rankGroup) {
      eventAirportRanksCollection = PastEventAirportRanks;
      matchQuery.rankGroup = rankGroup;
    }
    if(this.queryParams.locationId && this.queryParams.locationId !== "undefined") {
      const location = locationData.locations[this.queryParams.locationId];
      matchQuery.arrivalAirportId = {
        $in: location.airportIds
      };
    }
    if("" + this.queryParams.exUS == "true") {
      matchQuery.departureAirportId = {
        $nin: USAirportIds
      };
    }
    return {
      combinedValues: aggregate(eventAirportRanksCollection, [{
        $match: matchQuery
      }, {
        $group: {
          _id: null,
          passengerFlow: {
            $sum: "$passengerFlow"
          },
          infectedPassengers: {
            $sum: {
              $multiply: [
                "$probabilityPassengerInfected",
                "$passengerFlow"
              ]
            }
          },
          rank: {
            $sum: "$rank"
          },
          threatCoefficient: {
            $first: "$threatCoefficient"
          }
        }
      }])[0],
      results: aggregate(eventAirportRanksCollection, [{
        $match: matchQuery
      }, {
        $group: {
          _id: "$departureAirportId",
          passengerFlow: {
            $sum: "$passengerFlow"
          },
          infectedPassengers: {
            $sum: {
              $multiply: [
                "$probabilityPassengerInfected",
                "$passengerFlow"
              ]
            }
          },
          rank: {
            $sum: "$rank"
          }
        }
      }, {
        $sort: {
          rank: -1
        }
      }, {
        $limit: 100
      }])
    };
  }
});

/*
@api {get} bioevents Get a ranked list of bioevents
@apiParam {ISODateString} metric threatLevel/threatLevelExUS/mostRecent
*/
api.addRoute('bioevents', {
  authRequired: true
}, {
  get: function() {
    let resp = _.clone(rankedBioevents(
      this.queryParams.metric,
      null,
      this.queryParams.rankGroup || null));
    const minSeverity = parseFloat(this.queryParams.minDiseaseSeverity);
    resp.results = resp.results.filter((result)=>{
      if(!('threatCoefficient' in result)) return true;
      return result.threatCoefficient >= minSeverity;
    }).slice(0, 10);
    return resp;
  }
});

/*
@api {get} bioevents/:bioeventId Get top locations for the given bioevent
@apiName bioevents
*/
api.addRoute('bioevents/:bioeventId', {
  authRequired: true
}, {
  get: function() {
    let resolvedEventsCollection = ResolvedEvents;
    let eventAirportRanksCollection = EventAirportRanks;
    let rankGroup = this.queryParams.rankGroup;
    let query = {
      eventId: this.urlParams.bioeventId
    };
    if(rankGroup) {
      resolvedEventsCollection = PastResolvedEvents;
      eventAirportRanksCollection = PastEventAirportRanks;
      query.rankGroup = rankGroup;
    }
    let result = aggregate(eventAirportRanksCollection, [{
      $match: query
    }, {
      $facet: {
        "destination": [{
          $group: {
            _id: "$arrivalAirportId",
            rank: {
              $sum: "$rank"
            },
            rankExUS: {
              $sum: {
                $cond: [{
                  $in: ["$departureAirportId", USAirportIds]
                }, 0, "$rank"]
              }
            }
          }
        }],
        "origin": [{
          $group: {
            _id: "$departureAirportId",
            rank: {
              $sum: "$rank"
            },
            probabilityPassengerInfected: {
              $first: "$probabilityPassengerInfected"
            }
          }
        }]
      }
    }]);
    const airportValues = {
      threatLevelExposure: _.object(result[0].destination.map((x)=>[x._id, x.rank])),
      threatLevelExposureExUS: _.object(result[0].destination.map((x)=>[x._id, x.rankExUS])),
      originThreatLevel: _.object(result[0].origin.map((x)=>[x._id, x.rank])),
      originProbabilityPassengerInfected: _.object(result[0].origin.map((x)=>[x._id, x.probabilityPassengerInfected]))
    };
    let countryValues = {
      originThreatLevel: {},
      threatLevelExposure: {},
      threatLevelExposureExUS: {}
    };
    Object.keys(countryValues).forEach((key)=>{
      _.map(airportValues[key], (value, id) => {
        const country = airportToCountryCode[id];
        countryValues[key][country] = (
          countryValues[key][country] || 0) + value;
      });
    });
    let resolvedBioevent = resolvedEventsCollection.findOne(query, {fullLocations: -1});
    resolvedBioevent.name = resolvedBioevent.name.replace("Human ", "");
    return {
      airportValues: airportValues,
      countryValues: countryValues,
      resolvedBioevent: resolvedBioevent
    };
  }
});

/*
@api {get} userBioevents/:bioeventId Get airport and country stats for an user specified bioevent
@apiName bioevents
*/
api.addRoute('userBioevents/:bioeventId', {
  authRequired: true
}, {
  get: function() {
    let result = aggregate(UserAirportRanks, [{
      $match: {
        rankGroup: this.urlParams.bioeventId
      }
    }, {
      $facet: {
        "destination": [{
          $group: {
            _id: "$arrivalAirportId",
            rank: {
              $sum: "$rank"
            },
            rankExUS: {
              $sum: {
                $cond: [{
                  $in: ["$departureAirportId", USAirportIds]
                }, 0, "$rank"]
              }
            }
          }
        }],
        "origin": [{
          $group: {
            _id: "$departureAirportId",
            rank: {
              $sum: "$rank"
            },
            probabilityPassengerInfected: {
              $first: "$probabilityPassengerInfected"
            }
          }
        }]
      }
    }]);
    const airportValues = {
      threatLevelExposure: _.object(result[0].destination.map((x)=>[x._id, x.rank])),
      threatLevelExposureExUS: _.object(result[0].destination.map((x)=>[x._id, x.rankExUS])),
      originThreatLevel: _.object(result[0].origin.map((x)=>[x._id, x.rank])),
      originProbabilityPassengerInfected: _.object(result[0].origin.map((x)=>[x._id, x.probabilityPassengerInfected]))
    };
    let countryValues = {
      originThreatLevel: {},
      threatLevelExposure: {},
      threatLevelExposureExUS: {}
    };
    Object.keys(countryValues).forEach((key)=>{
      _.map(airportValues[key], (value, id) => {
        const country = airportToCountryCode[id];
        countryValues[key][country] = (
          countryValues[key][country] || 0) + value;
      });
    });
    return {
      airportValues: airportValues,
      countryValues: countryValues
    };
  }
});

/*
@api {get} lemis Get stats on imports of non-aqueous live wild animals by country.
*/
api.addRoute('lemis', {
  get: function() {
    const result = aggregate(Lemis, [{
      $group: {
        _id: "$country",
        lemisRecords: { $sum: { $ifNull: ["$records", 0] } },
        lemisValue: { $sum: { $ifNull: ["$value", 0] } },
        lemisQuantity: { $sum: { $ifNull: ["$quantity", 0] } }
      }
    }]);
    return result;
  }
});

/*
@api {get} lemis Get stats on the stop specied imported by the given country
*/
api.addRoute('lemis/:countryISO2', {
  get: function() {
    const result = aggregate(Lemis, [{
      $match: {
        country: this.urlParams.countryISO2
      }
    }, {
      $group: {
        _id: "$species",
        lemisRecords: { $sum: { $ifNull: ["$records", 0] } },
        lemisValue: { $sum: { $ifNull: ["$value", 0] } },
        lemisQuantity: { $sum: { $ifNull: ["$quantity", 0] } }
      }
    }]);
    return result;
  }
});

/*
@api {get} bioeventLastUpdate
*/
api.addRoute('bioeventLastUpdate', {
  get: function() {
    return aggregate(ResolvedEvents, [{
      $group: {
        _id: null,
        value: {
          $max: "$timestamp"
        }
      }
    }])[0];
  }
});

const diseaseNames = ResolvedEvents.find({}, {
  eventId: 1,
  name: 1
}).map((x)=>{
  return {
    id: 'bioevents/' + x.eventId,
    name: x.name.replace("Human ", "")
  };
});
/*
@api {get} bioeventNames Return the names of all bioevents for the search type-ahead.
*/
api.addRoute('bioeventNames', {
  get: function() {
    return diseaseNames;
  }
});

var cacheLastCleared = new Date(0);
/*
@api {get} clearCaches Delete all cached data.
*/
api.addRoute('clearCaches', {
  get: function() {
    let cacheClearableDate = new Date(cacheLastCleared);
    cacheClearableDate.setHours(cacheClearableDate.getHours() + 1);
    if(new Date() < cacheClearableDate) {
      return {
        statusCode: 400,
        body: 'Cache was already cleared in the past hour, please wait.'
      };
    }
    clearCaches();
    precacheFrequentValues();
    cacheLastCleared = new Date();
    return "Success";
  }
});
