var Flights = null;
var Airports = null;
var PassengerFlows = null;
var EventAirportRanks = null;
var ResolvedEvents = null;

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
  PastPassengerFlows = new Meteor.Collection('pastPassengerFlows', {
    _driver: db
  });
  EventAirportRanks = new Meteor.Collection('eventAirportRanks', {
    _driver: db
  });
  ResolvedEvents = new Meteor.Collection('resolvedEvents', {
    _driver: db
  });
  PastResolvedEvents = new Meteor.Collection('pastResolvedEvents', {
    _driver: db
  });
  PastEventAirportRanks = new Meteor.Collection('pastEventAirportRanks', {
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
  PassengerFlows: PassengerFlows,
  EventAirportRanks: EventAirportRanks,
  ResolvedEvents: ResolvedEvents,
  PastResolvedEvents: PastResolvedEvents,
  PastPassengerFlows: PastPassengerFlows,
  PastEventAirportRanks: PastEventAirportRanks
};
