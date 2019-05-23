/* global $ */
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

FlowRouter.triggers.enter([()=>$('.modal').modal('hide')]);

FlowRouter.route('/', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'splash'});
  }
});

FlowRouter.route('/lemis', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'lemis'});
  }
});

FlowRouter.route('/locations/:locationId', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'location'});
  }
});

FlowRouter.route('/bioevents/:bioeventId', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'bioevent'});
  }
});

FlowRouter.route('/userBioevents/:bioeventId', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'userBioevent'});
  }
});

FlowRouter.route('/userBioevents/', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'userBioevents'});
  }
});

FlowRouter.route('/about', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'about'});
  }
});

FlowRouter.route('/configure', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'configure'});
  }
});

FlowRouter.route('/submitUserBioevent', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'submitUserBioevent'});
  }
});

FlowRouter.route('/submitUserBioeventForm', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'submitUserBioeventForm'});
  }
});

FlowRouter.route('/admin', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'admin'});
  }
});