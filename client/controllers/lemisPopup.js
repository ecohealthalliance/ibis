import { FlowRouter } from 'meteor/kadira:flow-router';
import { _ } from 'meteor/underscore';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { sum } from '/imports/utils';

Template.lemisPopup.onCreated(function () {
  this.exportsBySpecies = new ReactiveVar([]);
  this.loading = new ReactiveVar(false);
});

Template.lemisPopup.onRendered(function() {
  let locatonISO2 = this.data.location.iso_a2;
  let mapType = FlowRouter.getQueryParam("mapType") || 'lemisRecords';
  this.loading.set(true);
  HTTPAuthenticatedGet(`/api/lemis/${locatonISO2}`)
    .finally(()=>this.loading.set(false))
    .then((resp) => {
      let total = sum(resp.data, x=>x[mapType]);
      resp.data.forEach((x)=>{
        x.value = 100 * x[mapType] / total;
        if(x._id) x.species = x._id.split('_').join(' ');
      });
      let sortedData = _.sortBy(resp.data, x=>-x.value);
      this.exportsBySpecies.set(sortedData.slice(0, 8).concat([{
        species: 'other',
        value: sum(sortedData.slice(8), x=>x.value)
      }]));
    });
});

Template.lemisPopup.helpers({
  loading: ()=>Template.instance().loading.get(),
  exportsBySpecies: ()=>Template.instance().exportsBySpecies.get()
});
