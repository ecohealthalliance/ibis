import Locations from '/imports/collections/Locations';
import {
  Flights,
  Airports,
  PassengerFlows
} from './FlightDB';
import WorldGeoJSON from '/imports/world.geo.json';

// Initialize with names used by airport data set that are not present in the
// world geojson file.
const nameToISOs = {
  'North Korea': 'KP',
  'South Korea': 'KR',
  'United States Minor Outlying Islands': 'US',
  'Macau': 'MO',
  'Reunion': 'RE',
  'Christmas Island': 'CX',
  'Guadeloupe': 'GP',
  'Ivory Coast (Cote d\'Ivoire)': 'CI',
  'French Guiana': 'GF',
  'Western Samoa': 'WS',
  'Saint Vincent and Grenadines': 'VC',
  'Guinea Bissau': 'GW',
  'Cocos (Keeling) Islands': 'CC',
  'Grenada and South Grenadines': 'GD',
  'Mayotte': 'YT',
  'Martinique': 'MQ',
  'Tuvalu': 'TV',
  'Gibraltar': 'GI'
};
const nameProps = [
  'name',
  'name_long',
  'formal_en',
  'name_alt',
  'name_sort',
  'formal_en',
  'brk_name'
];
WorldGeoJSON.features.forEach(({ properties }) => {
  nameProps.forEach((prop) => {
    const value = properties[prop];
    if (value) {
      nameToISOs[value] = properties.iso_a2;
    }
  });
});

const airportToCountry = _.chain(Airports.find({}).fetch())
  .groupBy('_id')
  .map((x, id) => {
    const countryName = x[0].countryName;
    return [id, nameToISOs[countryName]];
  })
  .object()
  .value();

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
    // Only return locations with incoming passengers
    let arrivalAirports = PassengerFlows.aggregate([{
      $group: {
        _id: "$arrivalAirport"
      }
    }]).map((x)=> "airport:" + x._id);
    return {
      locations: Locations.find({_id: {$in: arrivalAirports}}).fetch()
    };
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
      const country = airportToCountry[airportStats._id];
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
      //periodDays: periodDays,
      arrivalAirport: {
        $in: location.airportIds
      }
    }).fetch();
    let statsByCountry = {};
    results.forEach((result)=> {
      const country = airportToCountry[result.departureAirport];
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