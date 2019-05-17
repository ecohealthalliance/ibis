/*
This defines a loading indicator with a state state that is shared across all views.
The loading indicator blocks all interaction with the page.
Calling the show function will cause it to be displayed and return a
key than can be used to hide it again.
The loading indicator will only be hidden once all the keys
returned by show have been passed to the hide function.
Calling hide with no arguement will hide the loading indicator
and invalidate all the keys.
*/
let showing = new ReactiveVar(new Set());
export default {
  show: (message) => {
    const key = {
      message: message
    };
    let semaphoreSet = showing.curValue;
    semaphoreSet.add(key);
    showing.set(new Set(semaphoreSet));
    return key;
  },
  hide: (key) => {
    if(key) {
      let semaphoreSet = showing.curValue;
      showing.curValue.delete(key);
      showing.set(new Set(semaphoreSet));
    } else {
      showing.set(new Set());
    }
    return this;
  },
  showing: () => showing.get()
};
