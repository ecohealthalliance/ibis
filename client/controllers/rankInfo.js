import { _ } from 'meteor/underscore';
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.rankInfo.onCreated(function() {
  const locationId = this.data.locationId;
  const eventId = this.data.eventId;
  const rankedOrigins = this.rankedOrigins = new ReactiveVar([]);
  const threatCoefficient = this.threatCoefficient = new ReactiveVar(null);
  HTTP.get('/api/rankData', {
    params: {
      locationId: locationId,
      eventId: eventId
    }
  }, (err, resp) => {
    if (err) return console.error(err);
    const results = resp.data.results;
    rankedOrigins.set(results);
    if(results.length > 0) threatCoefficient.set(results[0].threatCoefficient);
  });
});

Template.rankInfo.helpers({
  threatCoefficient: () => Template.instance().threatCoefficient.get(),
  rankedOrigins: () => Template.instance().rankedOrigins.get(),
  toPrecision: (number, precision)=> number.toPrecision(precision)
});

