import { showHelpPanel } from '/imports/configuration';

Template.helpPanel.helpers({
  hidden: ()=>!showHelpPanel.get(),
  helpSection: ()=>{
    const templateName = Template.instance().data.mapType.get().replace("ExUS", "") + "About";
    return Blaze.toHTML(templateName);
  }
});

Template.helpPanel.events({
  'click .close': (event, instance)=>{
    showHelpPanel.set(false);
  }
});
