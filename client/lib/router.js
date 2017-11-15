FlowRouter.route('/', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'splash'});
  }
});

FlowRouter.route('/map', {
  action: function(params, queryParams) {
    BlazeLayout.render('layout', {main: 'map'});
  }
});
