import Constants from '/imports/constants';
module.exports = {
    OUTBOUND_RAMP: chroma.scale(["#ffffff", Constants.OUTBOUND_COLOR]).colors(10),
    INBOUND_RAMP: chroma.scale(["#ffffff", Constants.INBOUND_COLOR]).colors(10),
    getColor: (val, ramp) => {
      //return a color from the ramp based on a 0 to 1 value.
      //If the value exceeds one the last stop is used.
      return ramp[Math.floor(ramp.length * Math.max(0, Math.min(val, 0.99)))];
    }
};
