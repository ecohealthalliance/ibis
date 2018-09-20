import { FlowRouter } from 'meteor/kadira:flow-router';
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.rankInfo.onCreated(function() {
  const locationId = this.data.locationId;
  const eventId = this.data.eventId;
  const rankedOrigins = this.rankedOrigins = new ReactiveVar([]);
  const combinedValues = this.combinedValues = new ReactiveVar({});
  const loading = this.loading = new ReactiveVar(true);
  HTTP.get('/api/rankData', {
    params: {
      locationId: locationId,
      eventId: eventId,
      exUS: FlowRouter.getQueryParam('rankMetric') == 'threatLevelExUS'
    }
  }, (err, resp)=>{
    loading.set(false);
    if (err) return console.error(err);
    rankedOrigins.set(resp.data.results);
    combinedValues.set(resp.data.combinedValues);
  });
});

Template.rankInfo.helpers({
  combinedValues: () => Template.instance().combinedValues.get(),
  rankedOrigins: () => Template.instance().rankedOrigins.get(),
  loading: () => Template.instance().loading.get()
});

