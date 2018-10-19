let showing = new ReactiveVar(new Set());
export default {
  show: () => {
    const semaphore = {};
    let semaphoreSet = showing.curValue;
    semaphoreSet.add(semaphore);
    showing.set(new Set(semaphoreSet));
    return semaphore;
  },
  /*
  The semaphore returned by the show function can be passed in to the hide
  function so that the loading indicator will only be hidden if all
  the semaphores have been passed to the hide function.
  */
  hide: function(semaphore) {
    if(semaphore) {
      let semaphoreSet = showing.curValue;
      showing.curValue.delete(semaphore);
      showing.set(new Set(semaphoreSet));
    } else {
      showing.set(new Set());
    }
    return this;
  },
  showing: () => showing.get().size > 0
};
