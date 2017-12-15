/* global L, _, chroma */
import { HTTP } from 'meteor/http';
import { ReactiveVar } from 'meteor/reactive-var';
import Locations from '/imports/collections/Locations';
import WorldGeoJSON from '/imports/world.geo.json';

const MILLIS_PER_DAY = 60 * 60 * 24 * 1000;
const RAMP = chroma.scale(["#a10000", "#f07381"]).colors(10);
const getColor = (val) =>{
  //return a color from the ramp based on a 0 to 1 value.
  //If the value exceeds one the last stop is used.
  return RAMP[Math.floor(RAMP.length * Math.max(0, Math.min(val, 0.99)))];
};

Template.map.onCreated(function () {
  const endDate = new Date();
  const dateRange = this.dateRange = {
    start: new Date(endDate - 600 * MILLIS_PER_DAY),
    end: endDate
  };
  const bioevents = this.bioevents = new ReactiveVar([]);
  const bioeventIds = this.bioeventIds = new ReactiveVar([]);
  const bioeventIdsForPage = this.bioeventIdsForPage = new ReactiveVar([]);
  const instanceData  = this.data
  const selectedLocation = this.selectedLocation = new ReactiveVar();

  this.autorun(() => {
    const airportId     = FlowRouter.getParam('airportId');
    if( !_.isUndefined(airportId) ) {
      this.subscribe('locations', airportId)
    }
  });


  HTTP.get('/api/locations/airport:SEA/bioevents', {}, (err, resp)=> {
    if(err) return console.error(err);
    bioeventIds.set(resp.data.ids);
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
 
Template.map.onRendered(function () {
  
  L.Icon.Default.imagePath = '/packages/bevanhunt_leaflet/images/';
  const map = L.map('map');

  this.autorun(() => {
    const locationId  = FlowRouter.getParam('airportId');
    const location    = Locations.findOne( { _id: locationId } );
    if( location ) {
      _.each(location.displayGeoJSON, feature => {
        if(feature.type == "Point") {
          const coords = feature.coordinates[0];
          L.marker([coords[1], coords[0]]).addTo(map);
          this.selectedLocation.set( location._id );
        }
      });
    }

    HTTP.get(`/api/locations/${locationId}/inboundTrafficByCountry`, {
      // params: {
      //   arrivesBefore: "2017-10-10"
      // }
    }, (err, resp)=> {
      if(err) return console.error(err);
      const maxValue = _.max(_.values(resp.data));
      const geoJsonLayer = L.geoJson(WorldGeoJSON, {
        style: (feature) =>{
          // TODO: Use ISO2 codes for inboundTrafficByCountry resp. keys.
          const data = resp.data[feature.properties.name_long];
          const value = data ? data.numSeats : null;
          return {
            fillColor: value ? getColor(value / maxValue) : '#FFFFFF',
            weight: 1,
            color: '#DDDDDD',
            fillOpacity: 1
          };
        }
      }).addTo(map);
      map.setView([40.077946, -95.989253], 4);
    });
  });


});
 
Template.map.helpers({
  bioevents: ()=> Template.instance().bioevents.get(),
  dateRange: ()=> Template.instance().dateRange,
  selectedLocation: () => {
    return Template.instance().selectedLocation.get();
  }
});
