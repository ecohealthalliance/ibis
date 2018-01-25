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
