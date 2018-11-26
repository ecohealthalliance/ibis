module.exports = {
  MILLIS_PER_DAY: 60 * 60 * 24 * 1000,
  DATA_INTERVAL_DAYS: 14,
  INITIAL_MAP_VIEW: [40.077946, -75.989253],
  LEAFLET_MAP_CONFIG: {
  	zoomSnap: 0.5,
  	minZoom: 1,
  	maxZoom: 8
  },
  rankMetrics: [
    { name: "threatLevelExUS", label: "Threat Level (Ex. US)" },
    { name: "threatLevel", label: "Threat Level" },
    { name: "mostRecent", label: "Latest Incident" },
    { name: "activeCases", label: "Active Cases" }
  ],
  mapTypes: [
    { name:"threatLevelExposureExUS", label:"Inbound Threat Exposure (Excluding US Sources)" },
    { name:"threatLevelExposure", label:"Inbound Threat Exposure (Including US Sources)" },
    { name:"passengerFlow", label:"Inbound Passenger Flow" },
  ],
  locationMapTypes: [
    { name: "directSeats", label: "Direct Seats by Origin" },
    { name: "passengerFlow", label: "Estimated Inbound Passengers by Origin" },
    { name: "threatLevel", label: "Threat Level by Origin" }
    //{ name: "threatLevelExUS", label: "Threat Level by Origin (Excluding US Origins)" }
  ],
  bioeventMapTypes: [
    { name: "originThreatLevel", label: "Threat Level by Origin" },
    { name: "originProbabilityPassengerInfected", label: "Estimated Probability Passenger Infected by Origin" },
    { name: "threatLevelExposure", label: "Threat Exposure by Destination (Including US Sources)" },
    { name: "threatLevelExposureExUS", label: "Threat Exposure by Destination (Excluding US Sources)" },
    { name: "topOrigins", label: "Top Origins" },
    { name: "topDestinations", label: "Top Destinations" }
  ]
};