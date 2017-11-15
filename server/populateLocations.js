import Locations from '/imports/collections/Locations';

import {
  Flights,
  Airports
} from './FlightDB';

export default ()=>{
  //Populate locations
  Airports.find({
    countryName: "United States"
  }).map(function(airport) {
    if(Locations.findOne("state:" + airport.state)) {
      Locations.update("state:" + airport.state, {
        $addToSet: {
          airportIds: airport._id
        }
      });
    } else {
      console.log("Inserting", airport.state);
      Locations.insert({
        _id: "state:" + airport.state,
        type: "State",
        airportIds: [airport._id]
      });
    }

    Locations.upsert("airport:" + airport._id, {
      type: "Airport",
      airportIds: [airport._id],
      coordinates: [airport.loc.coordinates]
    });
  });
};
