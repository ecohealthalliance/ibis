import { FlowRouter } from 'meteor/kadira:flow-router';
import { _ } from 'meteor/underscore';
import { HTTPAuthenticatedGet } from '/imports/utils';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import Constants from '/imports/constants';
import loadingIndicator from '/imports/loadingIndicator';
import { defaultRankMetric } from '/imports/configuration';

Template.bioeventPanel.onCreated(function() {
  const minDiseaseSeverity = this.minDiseaseSeverity = new ReactiveVar(0.0);
  const dateRange = this.dateRange = new ReactiveVar({start: new Date(), end: new Date()});
  const bioevents = this.bioevents = new ReactiveVar([]);
  const rankMetric = this.rankMetric = new ReactiveVar();
  this.autorun(() => {
    rankMetric.set(FlowRouter.getQueryParam("rankMetric") || defaultRankMetric.get());
  });
  this.autorun(() => {
    const locationId = FlowRouter.getParam('locationId');
    const requestParams = {
      params: {
        metric: rankMetric.get(),
        rankGroup: FlowRouter.getQueryParam('rankGroup') || null,
        minDiseaseSeverity: minDiseaseSeverity.get()
      }
    };
    let url = "/api/bioevents";
    if (locationId) {
      url = `/api/locations/${locationId}/bioevents`;
    }
    const loadingIndicatorSemaphore = loadingIndicator.show();
    HTTPAuthenticatedGet(url, requestParams)
    .finally(() => loadingIndicator.hide(loadingIndicatorSemaphore))
    .then((resp) => {
      const respResults = EJSON.parse(resp.content).results;
      bioevents.set(respResults);
      if(respResults.length === 0) return;
      let endDate = new Date(respResults[0].event.timeseries.slice(-1)[0][0]);
      let startDate = new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY);
      dateRange.set({
        start: startDate,
        end: endDate
      });
    });
  });
});

Template.bioeventPanel.helpers({
  timelineMax: () => _.max(Template.instance().bioevents.get().map((x) => {
    const bioeventMax = _.chain(x.event.timeseries)
      .map(x => x[1])
      .max()
      .value();
    return bioeventMax;
  })),
  maxCasesForLocation: () => _.max(Template.instance().bioevents.get().map((x) => {
    return _.chain(x.event.locations)
      .values()
      .max()
      .value();
  })),
  bioevents: () => Template.instance().bioevents.get().map((x) => {
    if(x.lastIncident) x.lastIncident = ("" + x.lastIncident).split("T")[0];
    return x;
  }),
  dateRange: () => Template.instance().dateRange.get(),
  rankMetrics: () => {
    const selectedType = Template.instance().rankMetric.get();
    return Constants.rankMetrics.map((type) => {
      type.selected = type.name == selectedType;
      return type;
    });
  },
  minDiseaseSeverity: () => Template.instance().minDiseaseSeverity.get()
});

Template.bioeventPanel.events({
  'change #rank-metric': (event, instance) => {
    FlowRouter.setQueryParams({"rankMetric": event.target.value});
  },
  'click .bioevent-filter': (event, instance)=>{
    instance.$('#filter-modal').modal('show');
  },
  'click .set-filter': (event, instance)=>{
    instance.minDiseaseSeverity.set(parseFloat(instance.$('#filter-modal .min-disease-severity').val()));
  },
});
