module.exports = {
  formatNumber: (x, precisionLevel)=>{
    if(!_.isNumber(x)) {
      return x;
    } else {
      const result = parseFloat(x.toPrecision(precisionLevel || 3));
      if(result >= 1) {
        // Locale strings are rounded to the nearest .001 so they are not
        // used for small values.
        return result.toLocaleString();
      } else {
        return result.toString();
      }
    }
  }
};
