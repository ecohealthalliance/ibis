import { FlowRouter } from 'meteor/kadira:flow-router';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.rankInfo.onCreated(function() {
  const locationId = this.data.locationId;
  const eventId = this.data.eventId;
  const rankedOrigins = this.rankedOrigins = new ReactiveVar([]);
  const combinedValues = this.combinedValues = new ReactiveVar({});
  const loading = this.loading = new ReactiveVar(true);
  HTTPAuthenticatedGet('/api/rankData', {
    params: {
      locationId: locationId,
      eventId: eventId,
      exUS: FlowRouter.getQueryParam('rankMetric') == 'threatLevelExUS',
      rankGroup: FlowRouter.getQueryParam('rankGroup') || null
    }
  })
  .finally(()=>loading.set(false))
  .then((resp)=>{
    rankedOrigins.set(resp.data.results);
    combinedValues.set(resp.data.combinedValues);
  });
});

Template.rankInfo.helpers({
  combinedValues: () => Template.instance().combinedValues.get(),
  rankedOrigins: () => Template.instance().rankedOrigins.get(),
  loading: () => Template.instance().loading.get()
});

