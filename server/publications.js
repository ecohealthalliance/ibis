import Locations from '/imports/collections/Locations.js'

console.log("about to publish");

Meteor.publish('locations', () => Locations.find());
