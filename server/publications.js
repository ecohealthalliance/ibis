import Locations from '/imports/collections/Locations.js'

Meteor.publish('locations', () => Locations.find());