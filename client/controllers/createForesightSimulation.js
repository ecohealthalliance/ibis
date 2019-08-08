import { MILLIS_PER_DAY } from '/imports/constants';

Template.createForesightSimulation.onCreated(function() {
  this.multiplier = new ReactiveVar(1.0);
});

Template.createForesightSimulation.helpers({
  multiplier: ()=>Template.instance().multiplier.get(),
  locations: ()=>{
    const multiplier = Template.instance().multiplier.get();
    return Template.instance().data.locations.map((x)=>{
      let newX = Object.create(x);
      newX.value = Math.round(multiplier * x.value);
      return newX;
    });
  },
  foresightJSON: ()=>{
    const now = new Date();
    return JSON.stringify(Template.instance().data.locations.map((location)=>{
      return {
        airport: location.airport,
        infection: Math.round(location.value * Template.instance().multiplier.get()),
        day: Math.floor((now - new Date(now.toISOString().slice(0, 4))) / MILLIS_PER_DAY)
      };
    }));
  }
})

Template.createForesightSimulation.events({
  'keyup #multiplier': (event, instance)=>{
    instance.multiplier.set(parseFloat($(event.target).val()))
  }
});