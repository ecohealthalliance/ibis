import utils from '/imports/utils';
UI.registerHelper("formatNumber", (x)=>utils.formatNumber(x));
UI.registerHelper("toPrecision", (number, precision)=>number.toPrecision ? number.toPrecision(precision) : number);
