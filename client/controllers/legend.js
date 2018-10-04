Template.legend.helpers({
  title: () => Template.instance().data.title,
  legendValues: () => {
    const ramp = Template.instance().data.ramp.map((x)=>{
      return {
        color:x
      };
    });
    return ramp;
  },
  layers: () => Template.instance().data.layers.get(),
  airportTypes: () => {
    const airportTypeRV = Template.instance().data.airportType;
    const airportType = airportTypeRV ? airportTypeRV.get() : "all";
    return [
      { name: "domestic", label: "Domestic Airports" },
      { name: "international", label: "International Airports" },
      { name: "all", label: "All Airports" },
    ].map((x) => {
      x.checked = x.name == airportType;
      return x;
    });
  }
});

Template.legend.events({
  'click .layer input': (event, instance)=>{
    instance.data.layers.set(instance.data.layers.get().map((layer)=>{
      return {
        name: layer.name,
        label: layer.label,
        active: instance.$(`input[name='${layer.name}']`).prop('checked')
      };
    }));
  },
  'click .airport-types input': (event, instance)=>{
    const airportTypeRV = Template.instance().data.airportType;
    airportTypeRV.set($(event.target).val());
  }
});
