import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Template.userBioevents.onCreated(function() {
  this.subscribe('rankedUserEventStatuses');
});

Template.userBioevents.onRendered(function() {
  console.log("test")
});

Template.userBioevents.helpers({
  bioevents: ()=> RankedUserEventStatus.find()
});
