import { ReactiveVar } from 'meteor/reactive-var';
export default new ReactiveVar([{
  name: "bubbles",
  label: "Airport Bubbles",
  active: true
}, {
  name: "choropleth",
  label: "Shaded Regions",
  active: false
}]);
