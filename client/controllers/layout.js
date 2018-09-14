import showLoadingIndicator from '/imports/showLoadingIndicator';
import { showHelpPanel } from '/imports/configuration';

Template.layout.helpers({
  showLoadingIndicator: () => showLoadingIndicator.get()
});

Template.layout.events({
  'click .map-controls .tooltip-btn': ()=>{
    showHelpPanel.set(true);
  },
});
