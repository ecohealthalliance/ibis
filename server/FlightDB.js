var Flights = null;
var Airports = null;
var PassengerFlows = null;

try {
  let db = new MongoInternals.RemoteCollectionDriver(process.env.FLIGHT_MONGO_URL);
  Flights = new Meteor.Collection('flights', {
    _driver: db
  });
  Airports = new Meteor.Collection('airports', {
    _driver: db
  });
  PassengerFlows = new Meteor.Collection('passengerFlows', {
    _driver: db
  });
  Flights.rawCollection().createIndex({
    arrivalAirport: 1,
    arrivalDateTime: 1
  }, (error)=>{
    if(error) console.warn('[createIndex]: ', error);
  });
  if(!Flights.findOne()){
    console.warn('Flight collection is empty.');
  }
} catch (error) {
  console.warn(error);
  console.warn('Unable to connect to remote mongodb.');
}

module.exports = {
  Flights: Flights,
  Airports: Airports,
  PassengerFlows: PassengerFlows
};
