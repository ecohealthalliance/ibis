import showLoadingIndicator from '/imports/showLoadingIndicator';

Template.layout.helpers({
  showLoadingIndicator: () => showLoadingIndicator.get()
});
