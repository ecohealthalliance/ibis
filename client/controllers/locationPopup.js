Template.locationPopup.helpers({
  formatNumber: (x)=>{
    if(x < 10) {
      return x.toPrecision(2);
    } else {
      return Math.round(x);
    }
  }
})