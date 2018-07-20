import {
  Flights,
  Airports
} from './FlightDB';
import StateGeoJSON from '/imports/geoJSON/ch_2016_us_state_500k.geo.json';

let stateGeoJSONIndex = {};
StateGeoJSON.features.forEach((stateF)=>{
  stateGeoJSONIndex[stateF['properties']['STUSPS']] = [stateF];
});

let locations = {};

Airports.find().map((airport)=> {
  if(airport.countryName == "United States") {
    stateData = locations['state:' + airport.state];
    if(stateData) {
      stateData.airportIds.push(airport._id);
    } else {
      locations['state:' + airport.state] = {
        airportIds: [airport._id],
        displayName: airport.stateName,
        displayGeoJSON: stateGeoJSONIndex[airport.state]
      }
    }
  }
  locations['airport:' + airport._id] = {
    airportIds: [airport._id],
    displayName: airport.name,
    displayGeoJSON: [
      {
        "type": "Point", 
        "coordinates": airport.loc.coordinates
      }
    ]
  };
});

module.exports = {
  locations: locations,
  stateGeoJSONIndex: stateGeoJSONIndex,
  getDataForLocation: (locationId) => {
    let data = locations[locationId];
    if(!data) return;
    data = Object.create(data);
    if(locationId.startsWith('state:')) {
      data.displayGeoJSON = stateGeoJSONIndex[locationId];
    }
    if(locationId.startsWith('airport:')) {
      data.airportIds = [locationId.split(':')[1]];
    }
    return data;
  }
};
