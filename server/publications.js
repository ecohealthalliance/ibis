import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Meteor.publish("rankedUserEventStatus", function(rankGroup) {
  if(this.userId)
    return RankedUserEventStatus.find({rank_group: rankGroup});
});

ReactiveTable.publish("rankedUserEventStatuses", function () {
  if (this.userId) {
    return RankedUserEventStatus;
  } else {
    return [];
  }
}, {}, {
  disablePageCountReactivity: true,
  fields: {
    finished: 1,
    label: 1
  }
});
