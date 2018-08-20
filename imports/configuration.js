module.exports = _.chain({
    logTimeline: false,
    globalScale: false
  })
  .map((defaultValue, key)=>{
    const value = window.localStorage.getItem(key);
    return [
      key,
      new ReactiveVar(value === null ? defaultValue : value === "true")];
  })
  .object()
  .value();
