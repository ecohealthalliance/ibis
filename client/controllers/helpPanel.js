import { showHelpPanel } from '/imports/configuration';

Template.helpPanel.helpers({
  shown: ()=>showHelpPanel.get(),
  helpSection: ()=>{
    const templateName = Template.instance().data.mapType.get().replace("ExUS", "") + "About";
    return Blaze.toHTML(templateName);
  }
});

Template.helpPanel.events({
  'click .open': (event, instance)=>{
  	showHelpPanel.set(true);
  },
  'click .close': (event, instance)=>{
    showHelpPanel.set(false);
  },
});
