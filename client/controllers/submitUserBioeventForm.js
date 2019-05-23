import { HTTPAuthenticatedPost } from '/imports/utils';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { ReactiveVar } from 'meteor/reactive-var';

Template.submitUserBioeventForm.onCreated(function() {
  this.caseGroups = new Meteor.Collection(null);
  this.caseGroups.insert({});
});

Template.submitUserBioeventForm.helpers({
  caseGroups: ()=> Template.instance().caseGroups.find()
});

Template.submitUserBioeventForm.events({
  'click .add-case-group': function(event, instance) {
    instance.caseGroups.insert({});
  },
  'click .delete': function(event, instance) {
    instance.caseGroups.remove({_id: this._id});
  },
  'click .analyze': (event, instance) => {
    var locationValues = Array.from(instance.$('.case-group')).map((caseGroupEl)=>{
      let $caseGroupEl = $(caseGroupEl);
      return {
        value: parseFloat($caseGroupEl.find('.active-cases').val(), 10),
        location: "" + $caseGroupEl.find('.location').data('id')
      };
    });
    for(var i=0; i<locationValues.length; i++){
      if(!locationValues[i].value) {
        alert(`Invalid count on item ${i + 1}`);
        return;
      }
      if(!locationValues[i].location) {
        alert(`Invalid location on item ${i + 1}`);
        return;
      }
    }
    HTTPAuthenticatedPost('/api/scoreUserBioevent', {
      data: {
        json: JSON.stringify({
          label: instance.$('.heading').val(),
          start_date: new Date().toISOString(),
          active_case_location_tree: {
            "children": locationValues
          }
        })
      }
    }).then((resp) => {
      FlowRouter.go(`/userBioevents/${resp.data.rankGroup}`);
    });
  }
});
