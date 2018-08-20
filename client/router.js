FlowRouter.route('/', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'splash'});
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