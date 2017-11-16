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

FlowRouter.route('/map/:airportId', {
  action: function(params, queryParams) {
    console.log("Aiport ID:", params.airportId);
    BlazeLayout.render('layout', {main: 'map', airportId: params.airportId});
  }
});

