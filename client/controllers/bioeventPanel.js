/* global FlowRouter */
import { _ } from 'meteor/underscore';
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.bioeventPanel.onCreated(function() {
  const dateRange = this.dateRange = this.data.dateRange;
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
    if (locationId) {
      HTTP.get(`/api/locations/${locationId}/bioevents`, requestParams, (err, resp) => {
        if (err) return console.error(err);
        bioevents.set(EJSON.parse(resp.content).results);
      });
    }
    else {
      HTTP.get("/api/bioevents", requestParams, (err, resp) => {
        if (err) return console.error(err);
        bioevents.set(EJSON.parse(resp.content).results);
      });
    }
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
  dateRange: () => Template.instance().dateRange,
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
