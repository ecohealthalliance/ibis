module.exports = {
  OUTBOUND_RAMP: chroma.brewer.Reds.slice(0, -1),
  OUTBOUND_LINE: chroma.brewer.Reds.slice(-1)[0],
	INBOUND_RAMP: chroma.brewer.Blues.slice(0, -1),
  INBOUND_LINE: chroma.brewer.Blues.slice(-1)[0],
  getColor: (val, ramp) => {
    //return a color from the ramp based on a 0 to 1 value.
    //If the value exceeds one the last stop is used.
    return ramp[Math.floor(ramp.length * Math.max(0, Math.min(val, 0.99)))];
  }
};
