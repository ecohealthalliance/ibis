import Locations from '/imports/collections/Locations';
import {
  Flights,
  Airports
} from './FlightDB';

let api = new Restivus({
  useDefaultAuth: true,
  prettyJson: true
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
                $gte: new Date(this.queryParams.arrivesAfter || new Date(arrivesBefore - 1000000000))
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
    const foreignAirports = Airports.find({
      _id: {$in: _.uniq(_.pluck(results, '_id'))}
    }).fetch();
    const airportToCountry = _.chain(foreignAirports)
      .groupBy('_id')
      .map((x, id)=>[id, x[0].countryName])
      .object()
      .value();
    let statsByCountry = {};
    results.forEach((airportStats)=>{
      const country = airportToCountry[airportStats._id];
      const sofar = statsByCountry[country] || {
        numFlights: 0,
        numSeats: 0
      };
      sofar.numFlights += airportStats.numFlights;
      sofar.numSeats += airportStats.numSeats;
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
    return {
      ids:[
        // TODO: Populate with ranked list of bioevents
        'Hozt7LY7mJhcYxGQw',
        'YqpQ8B6QkTysGeR4Q',
        'vndMKRLPYS9pyc2ev',
        'gfnPs88SBb3aaBeeA'
      ]
    };
  }
});