Template.locationPopup.helpers({
  formatNumber: (x)=>{
    if(!_.isNumber(x)) {
      return x;
    } else if(x < 10) {
      return x.toPrecision(2);
    } else {
      return Math.round(x);
    }
  }
})