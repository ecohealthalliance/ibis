const HTTPAuthenticatedRequest = (method, url, options) => {
  if(!options) {
    options = {};
  }
  if(!options.headers) {
    options.headers = {};
  }
  options.headers["X-User-Id"] = Meteor.userId();
  options.headers["X-Auth-Token"] = window.localStorage.getItem("Meteor.loginToken");
  return new Promise((resolve, reject) =>{
    method(url, options, (err, resp)=> {
      if(err) return reject(err);
      resolve(resp);
    });
  });
};

module.exports = {
  sum: (arr, iteratee) => {
    return arr.map(iteratee).reduce((sofar, value)=>sofar + value, 0);
  },
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
  },
  HTTPAuthenticatedGet: (url, options) => {
    return HTTPAuthenticatedRequest(HTTP.get, url, options);
  },
  HTTPAuthenticatedPost: (url, options) => {
    return HTTPAuthenticatedRequest(HTTP.post, url, options);
  },
  capitalize: (str) => {
    return str[0].toUpperCase() + str.slice(1);
  }
};
