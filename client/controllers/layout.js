import loadingIndicator from '/imports/loadingIndicator';
import { showHelpPanel } from '/imports/configuration';

Template.layout.helpers({
  loadingIndicatorShowing: () => Array.from(loadingIndicator.showing())
});

Template.layout.events({
  'click .map-controls .tooltip-btn': ()=>{
    showHelpPanel.set(true);
  },
});
