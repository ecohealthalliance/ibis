OUTBOUND_RAMP = chroma.brewer.Reds;
OUTBOUND_LINE = OUTBOUND_RAMP.pop();
INBOUND_RAMP = chroma.brewer.Blues;
INBOUND_LINE = INBOUND_RAMP.pop();

module.exports = {
    OUTBOUND_RAMP: OUTBOUND_RAMP,
    INBOUND_RAMP: INBOUND_RAMP,
	OUTBOUND_LINE: OUTBOUND_LINE,
    INBOUND_LINE: INBOUND_LINE,
    getColor: (val, ramp) => {
      //return a color from the ramp based on a 0 to 1 value.
      //If the value exceeds one the last stop is used.
      return ramp[Math.floor(ramp.length * Math.max(0, Math.min(val, 0.99)))];
    }
};
