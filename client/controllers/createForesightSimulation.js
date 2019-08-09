import { MILLIS_PER_DAY } from '/imports/constants';

Template.createForesightSimulation.onCreated(function() {
  this.multiplier = new ReactiveVar(1000);
  this.uncheckedAirports = new ReactiveVar({});
});

Template.createForesightSimulation.helpers({
  multiplier: ()=>Template.instance().multiplier.get(),
  locations: ()=>{
    const multiplier = Template.instance().multiplier.get();
    const uncheckedAirports = Template.instance().uncheckedAirports.get();
    const locations = Template.instance().data.locations.map((x)=>{
      let newX = Object.create(x);
      if(uncheckedAirports[x.airport]){
        newX.value = 0;
      }
      return newX;
    });
    const totalValue = locations.reduce((sofar, cur)=>sofar + cur.value, 0);
    return _.sortBy(locations.map((x)=>{
      x.simulationPercent = (100 * x.value / totalValue) || 0;
      x.value = Math.round(multiplier * x.value / totalValue) || 0;
      return x;
    }), x=>-x.globalPercent);
  },
  foresightJSON: ()=>{
    const now = new Date();
    const multiplier = Template.instance().multiplier.get();
    const uncheckedAirports = Template.instance().uncheckedAirports.get();
    const locations = Template.instance().data.locations.map((x)=>{
      let newX = Object.create(x);
      if(uncheckedAirports[x.airport]){
        newX.value = 0;
      }
      return newX;
    });
    const totalValue = locations.reduce((sofar, cur)=>sofar + cur.value, 0);
    return JSON.stringify(locations.map((location)=>{
      return {
        airport: location.airport,
        infection: Math.round(location.value * multiplier / totalValue),
        day: Math.floor((now - new Date(now.toISOString().slice(0, 4))) / MILLIS_PER_DAY)
      };
    }).filter(x=>x.infection > 0));
  },
  airportIsChecked: (airport)=>{
    return !Template.instance().uncheckedAirports.get()[airport];
  }
});

Template.createForesightSimulation.events({
  'keyup #multiplier': (event, instance)=>{
    instance.multiplier.set(parseFloat($(event.target).val()) || 0)
  },
  'change .airport-checkbox': (event, instance)=>{
    let uncheckedAirports = _.clone(instance.uncheckedAirports.get());
    uncheckedAirports[$(event.target).prop('name')] = !$(event.target).prop('checked');
    instance.uncheckedAirports.set(uncheckedAirports);
  },
  'click .select-none': (event, instance)=>{
    instance.uncheckedAirports.set(_.object(instance.data.locations.map(l=>[l.airport, true])));
  },
  'click .select-all': (event, instance)=>{
    instance.uncheckedAirports.set({});
  }
});