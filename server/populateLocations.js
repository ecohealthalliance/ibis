import Locations from '/imports/collections/Locations';
import {
  Flights,
  Airports
} from './FlightDB';
import StateGeoJSON from '/imports/geoJSON/ch_2016_us_state_500k.geo.json';

let stateGeoJSONIndex = {};
StateGeoJSON.features.forEach((stateF)=>{
  stateGeoJSONIndex[stateF['properties']['STUSPS']] = [stateF];
});

export default ()=>{
  //Populate locations
  Locations.remove({});
  Airports.find({
    countryName: "United States"
  }).map((airport)=> {
    if(Locations.findOne("state:" + airport.state)) {
      Locations.update("state:" + airport.state, {
        $addToSet: {
          airportIds: airport._id
        }
      });
    } else {
      Locations.insert({
        _id: "state:" + airport.state,
        type: "state",
        airportIds: [airport._id],
        displayName: airport.stateName,
        displayGeoJSON: stateGeoJSONIndex[airport.state]
      });
    }
    Locations.upsert("airport:" + airport._id, {
      type: "airport",
      airportIds: [airport._id],
      displayName: airport.name,
      displayGeoJSON: [
        {
          "type": "Point", 
          "coordinates": airport.loc.coordinates
        }
      ]
    });
  });
};
