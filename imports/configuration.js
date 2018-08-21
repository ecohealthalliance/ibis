module.exports = _.chain({
    logTimeline: false,
    globalScale: false,
    constrainMaps: true,
    defaultActiveCaseTimeseries: true,
    airportCutoffPercentage: 0.5
  })
  .map((defaultValue, key)=>{
    const value = window.localStorage.getItem(key);
    return [
      key,
      new ReactiveVar(value === null ? defaultValue : JSON.parse(value))];
  })
  .object()
  .value();
