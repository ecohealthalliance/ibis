import { HTTPAuthenticatedPost } from '/imports/utils';
import { FlowRouter } from 'meteor/kadira:flow-router';

Template.submitUserBioevent.events({
  'click .analyze': (event, instance) => {
    HTTPAuthenticatedPost('/api/scoreUserBioevent', {
      data: {
        json: instance.$('textarea').val()
      }
    }).then((resp) => {
      FlowRouter.go(`/userBioevents/${resp.data.rankGroup}`);
    });
  }
});
