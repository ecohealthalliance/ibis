import utils from '/imports/utils';
UI.registerHelper("formatNumber", (x)=>utils.formatNumber(x));
UI.registerHelper("helpSection", ()=>{
  const templateName = Template.instance().mapType.get().replace("ExUS", "") + "About";
  return Blaze.toHTML(templateName);
});