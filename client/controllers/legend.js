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
  layers: () => Template.instance().data.layers.get()
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
});
