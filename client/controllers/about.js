Template.about.onCreated(function() {
  this.bioeventLastUpdate = new ReactiveVar();
  HTTP.get("/api/bioeventLastUpdate", {}, (err, resp) => {
    if(err) return console.error(err);
    this.bioeventLastUpdate.set(resp.data.value);
  });
});

Template.about.onRendered(function() {
  // Toggle the window location hash after the content is rendered
  // to trigger a scroll to the hash target.
  setTimeout(()=>{
    const originalHash = window.location.hash;
    if (originalHash) {
      window.location.replace(originalHash + "1");
      window.location.replace(originalHash);
    }
  }, 1);
});

Template.about.helpers({
  bioeventLastUpdate: () => Template.instance().bioeventLastUpdate.get()
});
