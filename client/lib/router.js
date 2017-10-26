FlowRouter.route('/', {
  action: function(params, queryParams) {
      BlazeLayout.render('splash', {} );
  }
});

FlowRouter.route('/map', {
  action: function(params, queryParams) {
      BlazeLayout.render('map', {} );
  }
});