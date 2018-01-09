import Locations from '/imports/collections/Locations.js'

Meteor.publish('locations', (id) => {
	return Locations.find({ _id : id });
});
