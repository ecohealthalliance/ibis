import { _ } from 'meteor/underscore';
import Locations from '/imports/collections/Locations';
import {
  Flights,
  PassengerFlows,
  EventAirportRanks
} from './FlightDB';
import { airportToCountryCode } from '/imports/geoJSON/indecies';


let api = new Restivus({
  useDefaultAuth: true,
  prettyJson: true
});


/*
@api {get} topLocations
@apiName topLocations
@apiGroup locations
*/
api.addRoute('topLocations', {
  get: function() {
    if(this.queryParams.metric === "threatLevel") {
      let arrivalAirportToRankScore = _.object(EventAirportRanks.aggregate([{
        $group: {
          _id: "$airportId",
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
      periodDays: periodDays,
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
@api {get} locations/:locationId/bioevents Get a list of bioevents ranked by their relevance to the given location.
*/
api.addRoute('locations/:locationId/bioevents', {
  get: function() {
    var location = Locations.findOne(this.urlParams.locationId);
    return {
      results: EventAirportRanks.aggregate([{
        $match: {
          airportId: {
            $in: location.airportIds
          }
        }
      }, {
        $group: {
          _id: "$event._id",
          rank: {
            $sum: "$rank"
          },
          event: {
            $first: "$event"
          }
        }
      }, {
        $sort: {
          rank: -1
        }
      }, {
        $limit: 10
      }])
    };
  }
});

/*
@api {get} bioevents Get a ranked list of bioevents
*/
api.addRoute('bioevents', {
  get: function() {
    return {
      results: EventAirportRanks.aggregate([{
        $group: {
          _id: "$event._id",
          rank: {
            $sum: "$rank"
          },
          event: {
            $first: "$event"
          }
        }
      }, {
        $sort: {
          rank: -1
        }
      }, {
        $limit: 10
      }])
    };
  }
});
