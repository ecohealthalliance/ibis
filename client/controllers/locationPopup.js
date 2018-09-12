import { _ } from 'meteor/underscore';

Template.locationPopup.onCreated(function () {
  this.threatLevelByDisease = new ReactiveVar([]);
  this.loading = new ReactiveVar(false);
});

Template.locationPopup.onRendered(function() {
  if(this.data && this.data.showThreatLevelByDisease) {
    let locationId = this.data.location._id;
    this.loading.set(true);
    HTTP.get(`/api/locations/${locationId}/threatLevelPosedByDisease`, (err, resp) => {
      this.loading.set(false);
      if (err) return console.error(err);
      this.threatLevelByDisease.set(_.sortBy(resp.data, x=>-x.threatLevel));
    });
  }
});

Template.locationPopup.helpers({
  loading: ()=>Template.instance().loading.get(),
  threatLevelByDisease: ()=>Template.instance().threatLevelByDisease.get()
});
