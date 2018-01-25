import { Meteor } from 'meteor/meteor';
import populateLocations from './populateLocations';

Meteor.startup(() => {
  populateLocations();
  console.log("Locations populated");
});
