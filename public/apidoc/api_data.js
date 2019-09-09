define({ "api": [
  {
    "type": "get",
    "url": "bioeventNames",
    "title": "Return the names of all bioevents for the search type-ahead.",
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents",
    "name": "GetBioeventnames"
  },
  {
    "type": "get",
    "url": "bioevents",
    "title": "Get a ranked list of bioevents",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "ISODateString",
            "optional": false,
            "field": "metric",
            "description": "<p>threatLevel/threatLevelExUS/mostRecent</p>"
          }
        ]
      }
    },
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents",
    "name": "GetBioevents"
  },
  {
    "type": "get",
    "url": "rankData",
    "title": "Get all the rank data for the bioevent and optional location.",
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents",
    "name": "GetRankdata"
  },
  {
    "type": "post",
    "url": "scoreUserBioevent",
    "title": "score an user created bioevent",
    "name": "bioevents",
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents"
  },
  {
    "type": "get",
    "url": "bioevents/:bioeventId",
    "title": "Get top locations for the given bioevent",
    "name": "bioevents",
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents"
  },
  {
    "type": "get",
    "url": "userBioevents/:bioeventId",
    "title": "Get airport and country stats for an user specified bioevent",
    "name": "bioevents",
    "group": "bioevents",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "bioevents"
  },
  {
    "type": "get",
    "url": "lemis",
    "title": "Get stats on imports of non-aqueous live wild animals by country.",
    "group": "lemis",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "lemis",
    "name": "GetLemis"
  },
  {
    "type": "get",
    "url": "lemis/:countryISO2",
    "title": "Get stats on the species imported by the given country",
    "group": "lemis",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "lemis",
    "name": "GetLemisCountryiso2"
  },
  {
    "type": "get",
    "url": "locations/:locationId/bioevents",
    "title": "Get a list of bioevents ranked by their relevance to the given location.",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations",
    "name": "GetLocationsLocationidBioevents"
  },
  {
    "type": "get",
    "url": "locations/:locationId/directSeats",
    "title": "Get inbound traffic stats",
    "name": "directSeats",
    "group": "locations",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "ISODateString",
            "optional": false,
            "field": "arrivesAfter",
            "description": ""
          },
          {
            "group": "Parameter",
            "type": "ISODateString",
            "optional": false,
            "field": "arrivesBefore",
            "description": ""
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "locations/:locationId/inboundFlights",
    "title": "Get inbound flights for the given location",
    "name": "inboundFlights",
    "group": "locations",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "ISODateString",
            "optional": false,
            "field": "arrivesAfter",
            "description": ""
          },
          {
            "group": "Parameter",
            "type": "ISODateString",
            "optional": false,
            "field": "arrivesBefore",
            "description": ""
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "locations/:locationId/outboundPassengerFlow",
    "title": "Get estimates of the total number of outbound passengers arriving at each country.",
    "name": "outboundPassengerFlow",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "locations/:locationId/passengerFlow",
    "title": "Get estimates of the total number of passengers arriving from each country.",
    "name": "passengerFlow",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "locations/:locationId/threatLevel",
    "title": "",
    "name": "threatLevel",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "locations/:locationId/threatLevelPosedByDisease",
    "title": "",
    "name": "threatLevelPosedByDisease",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "topLocations",
    "title": "",
    "name": "topLocations",
    "group": "locations",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "locations"
  },
  {
    "type": "get",
    "url": "bioeventLastUpdate",
    "title": "Get the last date for which resolved bioevent timeseries data is available.",
    "group": "misc",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "misc",
    "name": "GetBioeventlastupdate"
  },
  {
    "type": "get",
    "url": "clearCaches",
    "title": "Delete all cached data.",
    "group": "misc",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "misc",
    "name": "GetClearcaches"
  },
  {
    "type": "post",
    "url": "availableFlightSimMonths",
    "title": "get the months for which flight simulations have been created.",
    "name": "availableFlightSimMonths",
    "group": "misc",
    "version": "0.0.0",
    "filename": "server/api.js",
    "groupTitle": "misc"
  }
] });
