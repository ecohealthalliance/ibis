import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import { ReactiveVar } from 'meteor/reactive-var';

Template.searchBar.onCreated(function() {
  this.searchResults = new ReactiveVar()
  this.typeaheadPromise = Promise.all([
    locationGeoJsonPromise, 
    new Promise((resolve, reject) =>{
      HTTP.get('/api/bioeventNames', (err, resp)=> {
        if(err) return reject(err);
        resolve(resp.data);
      });
    })
  ]).then(([locationGeoJson, bioeventNames])=>{
    return _.map(locationGeoJson, (x, id)=>{
      return {
        id: "locaitons/" + id,
        name: x.displayName
      };
    }).concat(bioeventNames);
  });
  $(document).on('click', ()=> this.searchResults.set(null));
});

Template.searchBar.onRendered(function() {
});

Template.searchBar.helpers({
  results: ()=> Template.instance().searchResults.get()
});

Template.searchBar.events({
  'keypress #search': _.debounce((event, instance)=>{
    const $input = instance.$('#search');
    if($input.val().length == 0) return
    const searchRE = new RegExp($input.val().split(/[^a-z]/i).join("."), "i");
    instance.typeaheadPromise.then((items)=>{
      instance.searchResults.set(items.filter(x=>searchRE.test(x.name)).slice(0, 10))
    });
  })
});
  