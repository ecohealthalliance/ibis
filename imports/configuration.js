import { _ } from 'meteor/underscore';
import { Accounts } from 'meteor/accounts-base';

let configuration = _.chain({
    logTimeline: false,
    globalScale: false,
    constrainMaps: true,
    defaultActiveCaseTimeseries: true,
    showHelpPanel: true,
    airportCutoffPercentage: 0.5,
    minDiseaseSeverity: 0.0,
    defaultMapType: 'threatLevelExUS',
    defaultRankMetric: 'threatLevelExposureExUS'
  })
  .map((defaultValue, key)=>{
    const value = window.localStorage.getItem(key);
    return [
      key,
      new ReactiveVar(value === null ? defaultValue : JSON.parse(value))];
  })
  .object()
  .value();

Tracker.autorun(()=>{
  let configurationJSON = {};
  _.forEach(configuration, (value, key)=>{
    configurationJSON[key] = value.get();
  });
  Meteor.call("storeConfiguration", configurationJSON, (err, resp)=> {
    if(err) return console.error(err);
  });
});

Accounts.onLogin(()=>{
  Meteor.call("loadConfiguration", (err, resp)=> {
    if(err) return console.error(err);
    _.forEach(resp.configuration, (value, key)=>{
      configuration[key].set(value);
    });
  });
});

module.exports = configuration;
