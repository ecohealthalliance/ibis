Template.onOffBtns.helpers({
  onActive: ()=>Template.instance().data.state.get() ? "active" : "",
  offActive: ()=>Template.instance().data.state.get() ? "" : "active"
});

Template.onOffBtns.events({
  'click .on': (evt, instance)=>{
    instance.data.state.set(true);
  },
  'click .off': (evt, instance)=>{
    instance.data.state.set(false);
  }
});