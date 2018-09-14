import { _ } from 'meteor/underscore';

let sum = (arr, iteratee) => {
  return arr.map(iteratee).reduce((sofar, value)=>sofar + value, 0);
};

Template.locationPopup.onCreated(function () {
  this.threatByDisease = new ReactiveVar([]);
  this.loading = new ReactiveVar(false);
});

Template.locationPopup.onRendered(function() {
  if(this.data && this.data.showThreatLevelByDisease) {
    let locationId = this.data.location._id;
    this.loading.set(true);
    HTTP.get(`/api/locations/${locationId}/threatLevelPosedByDisease`, (err, resp) => {
      this.loading.set(false);
      if (err) return console.error(err);
      let totalThreatLevel = sum(resp.data, x=>x.threatLevel);
      resp.data.forEach((x)=>{
        x.value = 100 * x.threatLevel / totalThreatLevel;
      });
      let sortedData = _.sortBy(resp.data, x=>-x.value);
      this.threatByDisease.set(sortedData.slice(0, 3).concat([{
        value: sum(sortedData.slice(3), x=>x.value)
      }]));
    });
  }
});

Template.locationPopup.helpers({
  loading: ()=>Template.instance().loading.get(),
  threatByDisease: ()=>Template.instance().threatByDisease.get()
});
