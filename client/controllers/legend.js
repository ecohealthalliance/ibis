Template.legend.helpers({
  title: () => Template.instance().data.title,
  legendValues: () => {
    const ramp = Template.instance().data.ramp.map((x)=>{
      return {
        color:x
      };
    });
    return ramp;
  }
})
