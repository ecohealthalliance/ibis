import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Meteor.publish("rankedUserEventStatus", function(rankGroup) {
  if(this.userId)
    return RankedUserEventStatus.find({rank_group: rankGroup});
});

Meteor.publish("rankedUserEventStatuses", function() {
  if(this.userId)
    return RankedUserEventStatus.find({
      error: {$exists: false}
    });
});