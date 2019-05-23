import { ReactiveVar } from 'meteor/reactive-var';

var formatLocation = function(location) {
  if(!location) return "";
  let {name, admin2Name, admin1Name, countryName} = location;
  return _.chain([name, admin2Name, admin1Name, countryName]).compact().uniq().value().join(", ");
};

Template.locationSelect.onCreated(function() {
  this.searchResults = new ReactiveVar();
  this.location = new ReactiveVar();
  $(document).on('click', ()=> this.searchResults.set(null));
});

Template.locationSelect.helpers({
  location: ()=> Template.instance().location.get(),
  results: ()=> Template.instance().searchResults.get(),
  formatLocation: formatLocation
});

Template.locationSelect.events({
  'keyup #search': _.debounce((event, instance)=>{
    const $input = instance.$('#search');
    if($input.val().length == 0) return;
    HTTP.get("https://grits.eha.io/api/geoname_lookup/api/lookup", {
      params: {
        q: $input.val()
      }
    }, (err, resp)=>{
      if(err) return console.log(err);
      if(!resp.data.hits) return console.log(resp);
      instance.searchResults.set(resp.data.hits.map(x=>x._source));
    });
  }, 500),
  'click .geoname': function(event, instance){
    console.log(this);
    instance.location.set(this);
  }
});
