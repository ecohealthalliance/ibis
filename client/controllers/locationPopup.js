import { _ } from 'meteor/underscore';
import { HTTPAuthenticatedGet } from '/imports/utils';

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
    HTTPAuthenticatedGet(`/api/locations/${locationId}/threatLevelPosedByDisease`)
    .finally(()=>this.loading.set(false))
    .then((resp) => {
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
