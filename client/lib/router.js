FlowRouter.route('/', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'splash'});
  }
});

FlowRouter.route('/locations/:locationId', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'map'});
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
