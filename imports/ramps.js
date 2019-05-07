/* global chroma */
const OUTBOUND_RAMP = chroma.brewer.Reds.slice(0, -1);
const OUTBOUND_LINE = chroma.brewer.Reds.slice(-1)[0];
const INBOUND_RAMP = chroma.brewer.Blues.slice(0, -1);
const INBOUND_LINE = chroma.brewer.Blues.slice(-1)[0];

module.exports = {
  OUTBOUND_RAMP: OUTBOUND_RAMP,
  OUTBOUND_LINE: OUTBOUND_LINE,
	INBOUND_RAMP: INBOUND_RAMP,
  INBOUND_LINE: INBOUND_LINE,
  getColor: (val, ramp) => {
    //return a color from the ramp based on a 0 to 1 value.
    //If the value exceeds one the last stop is used.
    return ramp[Math.floor(ramp.length * Math.max(0, Math.min(val, 0.99)))];
  },
  getRamp: (mapType) => {
    if(mapType.startsWith('origin') || mapType.endsWith('Origins')) {
      return OUTBOUND_RAMP;
    } else {
      return INBOUND_RAMP;
    }
  },
  getLineColor: (mapType) => {
    if(mapType.startsWith('origin') || mapType.endsWith('Origins')) {
      return OUTBOUND_LINE;
    } else {
      return INBOUND_LINE;
    }
  }
};
