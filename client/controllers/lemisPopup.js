import { FlowRouter } from 'meteor/kadira:flow-router';
import { _ } from 'meteor/underscore';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { sum, capitalize } from '/imports/utils';
import Constants from '/imports/constants';

Template.lemisPopup.onCreated(function () {
  this.speciesData = new ReactiveVar([]);
  this.loading = new ReactiveVar(false);
});

Template.lemisPopup.onRendered(function() {
  let locatonISO2 = this.data.location.iso_a2;
  this.loading.set(true);
  HTTPAuthenticatedGet(`/api/lemis/${locatonISO2}`)
    .finally(()=>this.loading.set(false))
    .then((resp) => {
      this.speciesData.set(resp.data);
    });
});

Template.lemisPopup.helpers({
  loading: ()=>Template.instance().loading.get(),
  totalValue: ()=>{
    const mapType = FlowRouter.getQueryParam("mapType") || 'lemisQuantity';
    const speciesData = Template.instance().speciesData.get();
    return sum(speciesData, x=>x[mapType]);
  },
  unit: ()=>{
    const mapType = FlowRouter.getQueryParam("mapType") || 'lemisQuantity';
    return Constants.mapTypeToUnits[mapType];
  },
  exportsBySpecies: ()=>{
    const mapType = FlowRouter.getQueryParam("mapType") || 'lemisQuantity';
    const speciesData = Template.instance().speciesData.get();
    const total = sum(speciesData, x=>x[mapType]);
    if(total === 0) return [];
    speciesData.forEach((x)=>{
      x.value = x[mapType];
      x.portion = 100 * x[mapType] / total;
      if(x._id) x.species = x._id.split('_').map(capitalize).join(' ');
    });
    let sortedData = _.sortBy(speciesData, x=>-x.value);
    return sortedData.slice(0, 8).concat([{
      species: 'Other',
      value: sum(sortedData.slice(8), x=>x.value),
      portion: sum(sortedData.slice(8), x=>x.portion)
    }]);
  }
});
