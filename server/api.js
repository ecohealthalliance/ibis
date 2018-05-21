import { _ } from 'meteor/underscore';
import Locations from '/imports/collections/Locations';
import {
  Flights,
  PassengerFlows,
  EventAirportRanks,
  ResolvedEvents
} from './FlightDB';
import { airportToCountryCode, USAirportIds } from '/imports/geoJSON/indecies';


let api = new Restivus({
  useDefaultAuth: true,
  prettyJson: true
});

var cached = function(func) {
  let cache = {};
  let cacheDate = {};
  // Track least recently used items in cache so they can be deleted if the cache
  // grows too large.
  let lru = [];
  let that = this;
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
    if(lru.length > 4) {
      delete cache[lru[0]];
      delete cacheDate[lru[0]];
      lru = lru.slice(1);
    }
    return result;
  };
};

var topLocations = cached((metric)=>{
  if(metric.startsWith("threatLevel")) {
    const exUS = metric == "threatLevelExUS";
    let arrivalAirportToRankScore = _.object(EventAirportRanks.aggregate([{
      $match: {
        departureAirportId: {
          $nin: exUS ? USAirportIds : []
        }
      }
    }, {
      $group: {
        _id: "$arrivalAirportId",
        rank: {
          $sum: "$rank"
        }
      }
    }]).map((x)=> [x._id, x.rank]));
    return {
      locations: Locations.find({
        airportIds: {$in: Object.keys(arrivalAirportToRankScore)}
      }).map((location)=>{
        location.rank = 0;
        location.airportIds.forEach((airportId)=>{
          location.rank += arrivalAirportToRankScore[airportId] || 0;
        });
        return location;
      })
    };
  } else {
    const periodDays = 14;
    // Only return locations with incoming passengers
    let arrivalAirportToPassengers = _.object(PassengerFlows.aggregate([{
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
      locations: Locations.find({
        airportIds: {$in: Object.keys(arrivalAirportToPassengers)}
      }).map((location)=>{
        location.totalPassengers = 0;
        location.airportIds.forEach((airportId)=>{
          location.totalPassengers += arrivalAirportToPassengers[airportId] / periodDays || 0;
        });
        return location;
      })
    };
  }
});

var rankedBioevents = cached((metric, locationId=null)=>{
  const exUS = metric == "threatLevelExUS";
  const mostRecent = metric == "mostRecent";
  const activeCases = metric == "activeCases";
  if(mostRecent) {
    return {
      results: _.sortBy(ResolvedEvents.find().map((event)=>{
        return {
          _id: event._id,
          event: event,
          lastIncident: _.chain(event.dailyRateTimeseries || [])
            .map((x) => new Date(x[0]))
            .max()
            .value()
        };
      }), (event) => event.lastIncident).slice(-15).reverse()
    };
  } else if(activeCases) {
    return {
      results: _.sortBy(ResolvedEvents.find().map((event)=>{
        return {
          _id: event._id,
          event: event,
          activeCases: _.last(event.timeseries)[1]
        };
      }), (event) => event.activeCases).slice(-15).reverse()
    };
  } else {
    let matchQuery = {
      departureAirportId: {
        $nin: exUS ? USAirportIds : []
      }
    };
    if(locationId) {
      const location = Locations.findOne(locationId);
      matchQuery.arrivalAirportId = {
        $in: location.airportIds
      };
    }
    return {
      results: EventAirportRanks.aggregate([{
        $match: matchQuery
      }, {
        $group: {
          _id: "$eventId",
          rank: {
            $sum: "$rank"
          }
        }
      }, {
        $sort: {
          rank: -1
        }
      }, {
        $limit: 10
      }, {
        $lookup: {
          from: "resolvedEvents",
          localField: "_id",
          foreignField: "_id",
          as: "event"
        }
      }, { $unwind: "$event" }])
    };
  }
});

var updateCache = ()=>{
  ['threatLevel', 'threatLevelExUS', 'passengerFlow'].map((metric)=>{
    topLocations(metric);
  });
  rankedBioevents('threatLevel');
};
updateCache();
setInterval(updateCache, 1000 * 60 * 60);

/*
@api {get} topLocations
@apiName topLocations
@apiGroup locations
*/
api.addRoute('topLocations', {
  get: function() {
    return topLocations(this.queryParams.metric);
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
  get: function() {
    var location = Locations.findOne(this.urlParams.locationId);
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
@api {get} locations/:locationId/inboundTrafficByCountry Get inbound traffic stats by country
@apiName inboundTrafficByCountry
@apiGroup locations
@apiParam {ISODateString} arrivesAfter
@apiParam {ISODateString} arrivesBefore
*/
api.addRoute('locations/:locationId/inboundTrafficByCountry', {
  get: function() {
    const location = Locations.findOne(this.urlParams.locationId);
    const arrivesBefore = new Date(this.queryParams.arrivesBefore || new Date());
    const arrivesAfter = new Date(this.queryParams.arrivesAfter || new Date(arrivesBefore - 1000000000));
    const MILLIS_PER_DAY = 1000 * 60 * 60  * 24;
    const periodDays = (Number(arrivesBefore) - Number(arrivesAfter)) / MILLIS_PER_DAY;
    const results = Flights.aggregate([
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
      },
      {
        $group: {
          _id: "$departureAirport",
          numFlights: {
            $sum: 1
          },
          numSeats: {
            $sum: "$totalSeats"
          }
        }
      }
    ]);
    let statsByCountry = {};
    results.forEach((airportStats)=>{
      const country = airportToCountryCode[airportStats._id];
      const sofar = statsByCountry[country] || {
        numFlights: 0,
        numSeats: 0
      };
      sofar.numFlights += airportStats.numFlights / periodDays;
      sofar.numSeats += airportStats.numSeats / periodDays;
      statsByCountry[country] = sofar;
    });
    return statsByCountry;
  }
});

/*
@api {get} locations/:locationId/passengerFlowsByCountry Get estimates of the
  total number of passengers arriving from each country.
@apiName passengerFlowsByCountry
@apiGroup locations
*/
api.addRoute('locations/:locationId/passengerFlowsByCountry', {
  get: function() {
    const location = Locations.findOne(this.urlParams.locationId);
    const periodDays = 14;
    const results = PassengerFlows.find({
      simGroup: 'ibis14day',
      arrivalAirport: {
        $in: location.airportIds
      }
    }).fetch();
    let statsByCountry = {};
    results.forEach((result)=> {
      const country = airportToCountryCode[result.departureAirport];
      const sofar = statsByCountry[country] || {
        estimatedPassengers: 0
      };
      sofar.estimatedPassengers += result.estimatedPassengers / periodDays;
      statsByCountry[country] = sofar;
    });
    return statsByCountry;
  }
});

/*
@api {get} locations/:locationId/threatLevel
@apiName threatLevel
@apiGroup locations
*/
api.addRoute('locations/:locationId/threatLevel', {
  get: function() {
    const location = Locations.findOne(this.urlParams.locationId);
    const periodDays = 14;
    const results = EventAirportRanks.aggregate([{
      $match: {
        arrivalAirportId: {
          $in: location.airportIds
        }
      }
    }, {
      $group: {
        _id: "$departureAirportId",
        rank: {
          $sum: "$rank"
        }
      }
    }]);
    let statsByCountry = {};
    results.forEach((result) => {
      const country = airportToCountryCode[result._id];
      const sofar = statsByCountry[country] || {
        rank: 0
      };
      sofar.rank += result.rank / periodDays * 365;
      statsByCountry[country] = sofar;
    });
    return statsByCountry;
  }
});

/*
@api {get} locations/:locationId/bioevents Get a list of bioevents ranked by their relevance to the given location.
*/
api.addRoute('locations/:locationId/bioevents', {
  get: function() {
    return rankedBioevents(this.queryParams.metric, this.urlParams.locationId);
  }
});

/*
@api {get} rankData Get all the rank data for the bioevent and optional locaiton.
*/
api.addRoute('rankData', {
  get: function() {
    const exUS = this.queryParams.metric == "threatLevelExUS";
    var matchQuery = {
      departureAirportId: {
        $nin: exUS ? USAirportIds : []
      },
      eventId: this.queryParams.eventId,
      rank: {
        $gt: 0
      }
    };
    if(this.queryParams.locationId && this.queryParams.locationId !== "undefined") {
      const location = Locations.findOne(this.queryParams.locationId);
      matchQuery.arrivalAirportId = {
        $in: location.airportIds
      };
    }
    return {
      results: EventAirportRanks.aggregate([{
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
  get: function() {
    return rankedBioevents(this.queryParams.metric);
  }
});

/*
@api {get} bioeventLastUpdate
*/
api.addRoute('bioeventLastUpdate', {
  get: function() {
    return ResolvedEvents.aggregate([{
      $group: {
        _id: null,
        value: {
          $max: "$timestamp"
        }
      }
    }])[0];
  }
});
