/* global FlowRouter */
import { _ } from 'meteor/underscore';
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.bioeventPanel.onCreated(function() {
  const dateRange = this.dateRange = this.data.dateRange;
  const bioevents = this.bioevents = new ReactiveVar([]);
  const rankMetric = this.rankMetric = new ReactiveVar("threatLevel");

  this.autorun(() => {
    const locationId = FlowRouter.getParam('locationId');
    this.subscribe('locations', locationId);
    const requestParams = {
      params: {
        metric: rankMetric.get()
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
  maxCases: () => _.max(Template.instance().bioevents.get().map((x) => {
    return _.max(_.pluck(x.event.timeseries, 'value'));
  })),
  bioevents: () => Template.instance().bioevents.get().map((x) => {
    if(x.rank) x.rank = x.rank.toFixed(2);
    if(x.lastIncident) x.lastIncident = ("" + x.lastIncident).split("T")[0];
    return x;
  }),
  dateRange: () => Template.instance().dateRange,
  rankMetrics: () => {
    const selectedType = Template.instance().rankMetric.get();
    return [
      { name: "threatLevel", label: "Ranked by Threat Level" },
      { name: "threatLevelExUS", label: "Ranked by Threat Level (Ex. US)" },
      { name: "mostRecent", label: "Ranked by Latest Incident" }
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
