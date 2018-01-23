import { Airports } from '/server/FlightDB';
import WorldGeoJSON from '/imports/geoJSON/world.geo.json';

// Initialize with names used by airport data set that are not present in the
// world geojson file.
let nameToISOs = {
  'North Korea': 'KP',
  'South Korea': 'KR',
  'United States Minor Outlying Islands': 'US',
  'Macau': 'MO',
  'Reunion': 'RE',
  'Christmas Island': 'CX',
  'Guadeloupe': 'GP',
  'Ivory Coast (Cote d\'Ivoire)': 'CI',
  'French Guiana': 'GF',
  'Western Samoa': 'WS',
  'Saint Vincent and Grenadines': 'VC',
  'Guinea Bissau': 'GW',
  'Cocos (Keeling) Islands': 'CC',
  'Grenada and South Grenadines': 'GD',
  'Mayotte': 'YT',
  'Martinique': 'MQ',
  'Tuvalu': 'TV',
  'Gibraltar': 'GI'
};
const nameProps = [
  'name',
  'name_long',
  'formal_en',
  'name_alt',
  'name_sort',
  'formal_en',
  'brk_name'
];
WorldGeoJSON.features.forEach(({ properties }) => {
  nameProps.forEach((prop) => {
    const value = properties[prop];
    if (value) {
      nameToISOs[value] = properties.iso_a2;
    }
  });
});

const airportToCountryCode = _.chain(Airports.find({}).fetch())
  .groupBy('_id')
  .map((x, id) => {
    const countryName = x[0].countryName;
    return [id, nameToISOs[countryName]];
  })
  .object()
  .value();

const countriesByCode = _.chain(WorldGeoJSON.features)
  .map(({ properties }) => {
    return [properties.iso_a2, properties];
  })
  .object()
  .value();

module.exports = {
  airportToCountryCode: airportToCountryCode,
  countriesByCode: countriesByCode
};
