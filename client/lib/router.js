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
