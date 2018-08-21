Template.inputBox.helpers({
  value: ()=>Template.instance().data.state.get()
});

Template.inputBox.events({
  'change input': (evt, instance)=>{
    let value = $(evt.target).val();
    if(instance.data.type === "number") {
      value = parseFloat(value);
    }
    instance.data.state.set(value);
  }
});
