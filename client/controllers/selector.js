Template.selector.helpers({
  options: ()=>{
    const value = Template.instance().data.state.get();
    return Template.instance().data.options.map((x)=>{
      return {
        value: x.name,
        label: x.label,
        selected: x.name === value
      };
    });
  }
});

Template.selector.events({
  'change select': (evt, instance)=>{
    let value = $(evt.target).val();
    instance.data.state.set(value);
  }
});
