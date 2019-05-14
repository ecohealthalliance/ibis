let RankedUserEventStatus = new Meteor.Collection('rankedUserEventStatus');

Meteor.publish("rankedUserEventStatus", function(rankGroup) {
    return RankedUserEventStatus.find({rank_group: rankGroup});
});
