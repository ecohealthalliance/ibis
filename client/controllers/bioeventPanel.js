/* global FlowRouter */
import { _ } from 'meteor/underscore';
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import Constants from '/imports/constants';

Template.bioeventPanel.onCreated(function() {
  const dateRange = this.dateRange = new ReactiveVar({start: new Date(), end: new Date()});
  const bioevents = this.bioevents = new ReactiveVar([]);
  const rankMetric = this.rankMetric = new ReactiveVar("threatLevelExUS");

  this.autorun(() => {
    const locationId = FlowRouter.getParam('locationId');
    const requestParams = {
      params: {
        metric: rankMetric.get(),
        rankGroup: FlowRouter.getQueryParam('rankGroup') || null
      }
    };
    let url = "/api/bioevents";
    if (locationId) {
      url = `/api/locations/${locationId}/bioevents`
    }
    HTTP.get(url, requestParams, (err, resp) => {
      if (err) return console.error(err);
      const respResults = EJSON.parse(resp.content).results;
      bioevents.set(respResults);
      let endDate = new Date(respResults[0].event.timeseries.slice(-1)[0][0]);
      let startDate = new Date(endDate - Constants.DATA_INTERVAL_DAYS * Constants.MILLIS_PER_DAY)
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
    if(x.rank) x.rank = x.rank.toPrecision(2);
    if(x.activeCases) x.activeCases = x.activeCases.toPrecision(2);
    if(x.lastIncident) x.lastIncident = ("" + x.lastIncident).split("T")[0];
    return x;
  }),
  dateRange: () => Template.instance().dateRange.get(),
  rankMetrics: () => {
    const selectedType = Template.instance().rankMetric.get();
    return [
      { name: "threatLevelExUS", label: "Threat Level (Ex. US)" },
      { name: "threatLevel", label: "Threat Level" },
      { name: "mostRecent", label: "Latest Incident" },
      { name: "activeCases", label: "Active Cases" }
    ].map((type) => {
      type.selected = type.name == selectedType;
      return type;
    });
  }
});

Template.bioeventPanel.events({
  'change #rank-metric': (event, instance) => {
    instance.rankMetric.set(event.target.value);
  }
});
