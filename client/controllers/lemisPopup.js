import { FlowRouter } from 'meteor/kadira:flow-router';
import { _ } from 'meteor/underscore';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { sum } from '/imports/utils';

const capitalize = (str)=>str[0].toUpperCase() + str.slice(1);

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
  exportsBySpecies: ()=>{
    const mapType = FlowRouter.getQueryParam("mapType") || 'lemisRecords';
    const speciesData = Template.instance().speciesData.get();
    const total = sum(speciesData, x=>x[mapType]);
    if(total === 0) return [];
    speciesData.forEach((x)=>{
      x.value = 100 * x[mapType] / total;
      if(x._id) x.species = x._id.split('_').map(capitalize).join(' ');
    });
    let sortedData = _.sortBy(speciesData, x=>-x.value);
    return sortedData.slice(0, 8).concat([{
      species: 'Other',
      value: sum(sortedData.slice(8), x=>x.value)
    }]);
  }
});
