import { _ } from 'meteor/underscore';
import configuration from '/imports/configuration';
import {
  mapTypes,
  bioeventMapTypes,
  locationMapTypes,
  rankMetrics } from '/imports/constants';

Template.configure.onCreated(function() {
  _.forEach(configuration, (value, key)=>{
    this.autorun(()=>{
      window.localStorage.setItem(key, JSON.stringify(value.get()));
    });
  });
});

Template.configure.helpers({
  states: ()=>configuration,
  rankMetrics: ()=>rankMetrics,
  mapTypes: ()=>mapTypes,
  bioeventMapTypes: ()=>bioeventMapTypes,
  locationMapTypes: ()=>locationMapTypes
});
