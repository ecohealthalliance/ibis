import locationGeoJsonPromise from '/imports/locationGeoJsonPromise';
import bioeventNamePromise from '/imports/bioeventNamePromise';
import { ReactiveVar } from 'meteor/reactive-var';

const regexEscape = (s)=>s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')

Template.searchBar.onCreated(function() {
  this.searchResults = new ReactiveVar()
  this.typeaheadPromise = Promise.all([
    locationGeoJsonPromise, 
    bioeventNamePromise
  ]).then(([locationGeoJson, bioeventNames])=>{
    return _.map(locationGeoJson, (x, id)=>{
      const [locationType, locationName] = id.split(':');
      const type = {};
      type[locationType] = true;
      return {
        type: type,
        id: "locations/" + id,
        name: x.displayName + ` (${locationName})`
      };
    }).concat(bioeventNames.map((name)=>{
      name = Object.create(name);
      name.type = {bioevent: true};
      return name;
    }));
  });
  $(document).on('click', ()=>this.searchResults.set(null));
});

Template.searchBar.helpers({
  results: ()=> Template.instance().searchResults.get()
});

Template.searchBar.events({
  'keyup #search': _.debounce((event, instance)=>{
    const $input = instance.$('#search');
    if($input.val().length == 0) return
    const searchRE = new RegExp(regexEscape($input.val()), "i");
    instance.typeaheadPromise.then((items)=>{
      instance.searchResults.set(items.filter(x=>searchRE.test(x.name)).slice(0, 10))
    });
  })
});
