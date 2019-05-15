import utils from '/imports/utils';
import ramps from '/imports/ramps';
UI.registerHelper("formatNumber", (x)=>utils.formatNumber(x));
UI.registerHelper("toPrecision", (number, precision)=>number.toPrecision ? number.toPrecision(precision) : number);
UI.registerHelper("ramps", ()=> ramps);
