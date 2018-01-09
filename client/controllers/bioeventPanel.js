/* global _, FlowRouter */
import { HTTP } from 'meteor/http';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

Template.bioeventPanel.onCreated(function () {
  const dateRange = this.dateRange = this.data.dateRange;
  const bioevents = this.bioevents = new ReactiveVar([]);
  const bioeventIds = this.bioeventIds = new ReactiveVar([]);
  const bioeventIdsForPage = this.bioeventIdsForPage = new ReactiveVar([]);

  this.autorun(()=> {
    const locationId = FlowRouter.getParam('locationId');
    this.subscribe('locations', locationId);

    HTTP.get(`/api/locations/${locationId}/bioevents`, {}, (err, resp)=> {
      if(err) return console.error(err);
      bioeventIds.set(resp.data.ids);
    });
  });
  this.autorun(()=> {
    // TODO: Add pagination
    bioeventIdsForPage.set(bioeventIds.get());
  });
  this.autorun(()=> {
    let bioeventIdsToGet = bioeventIdsForPage.get();
    if(bioeventIdsToGet.length > 0) {
      HTTP.get('https://eidr-connect.eha.io/api/events-with-resolved-data', {
        params: {
          ids: bioeventIdsToGet,
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        },
      }, (err, resp)=> {
        if(err) return console.error(err);
        bioevents.set(resp.data.events);
      });
    }
  });
});

Template.bioeventPanel.helpers({
  bioevents: ()=> Template.instance().bioevents.get(),
  dateRange: ()=> Template.instance().dateRange,
});
