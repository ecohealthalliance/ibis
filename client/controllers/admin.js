import { Roles } from 'meteor/alanning:roles';

Template.admin.onCreated(function() {
  this.subscribe("allUsers");
  this.subscribe("roles");
});

Template.admin.helpers({
  adminUsers: () => Meteor.users.find({ roles: {$in: ["admin"]} }, {sort: {'profile.name': 1}}),
  defaultUsers: () => Meteor.users.find({ roles: {$nin: ["admin"]} }, {sort: {'profile.name': 1}}),
});

Template.admin.events({
  'submit #add-account': (event) => {
    if(event.isDefaultPrevented()) return;
    var form = event.target;
    event.preventDefault();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var makeAdmin = form.admin.checked;

    Meteor.call('createAccount', email, name, makeAdmin, (error, result) => {
      if(error) {
        if(error.error === 'allUsers.createAccount.exists') {
          alert('The specified email address is already being used');
        } else {
          alert(error.error + ":\n" + error.reason);
        }
      } else {
         form.reset();
      }
    });
  }
});


Template.userInfo.helpers({
  isCurrentUser: function(){
    return this._id == Meteor.userId();
  },
  name: function(){
    return this.profile.name;
  },
  email: function(){
    if(this.emails) return this.emails[0].address;
  },
  userInRole: function(role){
    return Roles.userIsInRole(this._id, role);
  }
});

Template.userInfo.events({
  'click .make-admin': (event, template) => Meteor.call('makeAdmin', template.data._id),
  'click .remove-admin': (event, template) => Meteor.call('removeAdmin', template.data._id)
});