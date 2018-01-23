/* global _, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.bioeventPanel.onCreated(function() {
  const dateRange = this.dateRange = this.data.dateRange;
  const bioevents = this.bioevents = new ReactiveVar([]);
  const rankMetric = this.rankMetric = new ReactiveVar("threatLevel");

  this.autorun(()=> {
    const locationId = FlowRouter.getParam('locationId');
    this.subscribe('locations', locationId);
    const requestParams = {
      params: {
        metric: rankMetric.get()
      }
    };
    if(locationId) {
      HTTP.get(`/api/locations/${locationId}/bioevents`, requestParams, (err, resp)=> {
        if(err) return console.error(err);
        bioevents.set(EJSON.parse(resp.content).results);
      });
    } else {
      HTTP.get("/api/bioevents", requestParams, (err, resp)=> {
        if(err) return console.error(err);
        bioevents.set(EJSON.parse(resp.content).results);
      });
    }
  });
});

Template.bioeventPanel.helpers({
  bioevents: ()=> Template.instance().bioevents.get().map((x)=> {
    x.rank = x.rank.toFixed(2);
    return x;
  }),
  dateRange: ()=> Template.instance().dateRange,
  rankMetrics: ()=> {
    const selectedType = Template.instance().rankMetric.get();
    return [
      {name:"rankMetric", label:"Ranked by Threat Level"}
    ].map((type)=> {
      type.selected = type.name == selectedType;
      return type;
    });
  }
});

Template.bioeventPanel.events({
  'change #rank-metric': (event, instance)=> {
    instance.rankMetric.set(event.target.value);
  }
});
