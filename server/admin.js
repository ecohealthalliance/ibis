import { Roles } from 'meteor/alanning:roles';
import { Accounts } from 'meteor/accounts-base';

Accounts.emailTemplates.siteName = "IBIS";
Accounts.emailTemplates.from = "IBIS <no-reply@eha.io>";

Meteor.startup(function() {
  if (!Meteor.users.find().count()) {
    let userData = {
      email: "admin@eha.io"
    };
    if(Meteor.settings.private) {
      userData = Meteor.settings.private.initial_user;
    }
    if (userData) {
      userData.profile = {
        name: 'Admin'
      };
      console.log(`[ Creating initial user with email ${userData.email} ]`);
      Accounts.createUser(userData);
      let newUserRecord = Meteor.users.findOne({
        'emails.address': userData.email
      });
      if (newUserRecord) {
        return Roles.addUsersToRoles(newUserRecord._id, ['admin']);
      }
    } else {
      return console.warn('[ Meteor.settings.private.initial_user object is required to create the initial user record ]');
    }
  }
});

Meteor.methods({
  makeAdmin: function(userId) {
    var currentUserId;
    currentUserId = Meteor.userId();
    if (Roles.userIsInRole(currentUserId, ['admin'])) {
      return Roles.addUsersToRoles(userId, ['admin']);
    } else {
      throw new Meteor.Error(403, "Not authorized");
    }
  },
  removeAdmin: function(userId) {
    var currentUserId;
    currentUserId = Meteor.userId();
    if (Roles.userIsInRole(currentUserId, ['admin'])) {
      return Roles.removeUsersFromRoles(userId, 'admin');
    } else {
      throw new Meteor.Error(403, "Not authorized");
    }
  },
  removeCurator: function(userId) {
    var currentUserId;
    currentUserId = Meteor.userId();
    if (Roles.userIsInRole(currentUserId, ['admin'])) {
      return Roles.removeUsersFromRoles(userId, 'curator');
    } else {
      throw new Meteor.Error(403, "Not authorized");
    }
  },
  createAccount: function(email, profileName, giveAdminRole) {
    var existingUser, newUserId;
    if (Roles.userIsInRole(Meteor.userId(), ['admin'])) {
      existingUser = Accounts.findUserByEmail(email);
      if (existingUser) {
        throw new Meteor.Error('allUsers.createAccount.exists');
      } else {
        newUserId = Accounts.createUser({
          email: email,
          profile: {
            name: profileName
          }
        });
        if (giveAdminRole) {
          Roles.addUsersToRoles(newUserId, ['admin']);
        }
        return Accounts.sendEnrollmentEmail(newUserId);
      }
    } else {
      throw new Meteor.Error(403, "Not authorized");
    }
  }
});

Meteor.publish("allUsers", function() {
  if (!Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error('auth', 'User does not have permission to access user data');
  }
  return Meteor.users.find({}, {
    fields: {
      '_id': 1,
      'roles': 1,
      'profile.name': 1,
      'emails': 1
    }
  });
});

Meteor.publish("roles", function() {
  if (!Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error('auth', 'User does not have permission to access user data');
  }
  return Meteor.roles.find({});
});
