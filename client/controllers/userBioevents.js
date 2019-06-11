import RankedUserEventStatus from '/imports/rankedUserEventStatus';

Template.userBioevents.helpers({
  tableSettings: ()=> {
    var filter = new ReactiveTable.Filter("finished", ['finished']);
    filter.set({$exists: true});
    return {
      filters: ["finished"],
      fields: [
        {
          key: "label",
          label: "label",
          fn: (value, object)=> new Spacebars.SafeString(`<a href="/userBioevents/${object.rank_group}">${value}</a>`)
        }, {
          key: "finished",
          label: "finished",
          sortOrder: 1,
          sortDirection: -1,
          fn: (value, object, key)=>{
            if(value != null){
              return value.toLocaleString();
            } else {
              "Unfinished";
            }
          }
        }
      ]
    };
  }
});
