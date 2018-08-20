import configuration from '/imports/configuration';

Template.configure.onCreated(function() {
  _.forEach(configuration, (value, key)=>{
    this.autorun(()=>{
      window.localStorage.setItem(key, value.get());
    });
  });
});

Template.configure.helpers({
  states: ()=>configuration
});
