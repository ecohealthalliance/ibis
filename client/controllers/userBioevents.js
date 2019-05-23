import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Template.userBioevents.onCreated(function() {
  this.subscribe('rankedUserEventStatuses');
});

Template.userBioevents.helpers({
  bioevents: ()=> RankedUserEventStatus.find()
});
