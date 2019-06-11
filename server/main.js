import { Meteor } from 'meteor/meteor';
import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Meteor.startup(() => {
  RankedUserEventStatus.rawCollection().createIndex({finished: 1});
});
