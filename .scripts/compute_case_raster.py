import datetime
import pymongo
import pandas as pd
import math
import shapely
import geopandas as gpd
import rasterio
import rasterio.features
import rasterio.enums
import PIL.Image
import numpy as np
from geopy.distance import great_circle
import matplotlib
import rasterstats 

matplotlib.use('PS')

def save_image(raster, name):
    img = PIL.Image.fromarray(
        np.array(255 * raster / raster.max(),
        dtype=np.uint8))
    img.save(name + ".png", "PNG")

world_df = gpd.read_file("../imports/geoJSON/world.geo.json")
# Use cylindrical equal-area projection
# https://gis.stackexchange.com/questions/218450/getting-polygon-areas-using-geopandas
world_df = world_df.to_crs({'proj': 'cea'})

def get_airport_to_country_code(db):
    nameToISOs = {
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
      'Gibraltar': 'GI',
      'Bonaire, Saint Eustatius & Saba': None,
      'Palestinian Territory': None,
      'Curacao': None,
      'Unknown Country': None
    }
    name_props = [
      'name',
      'name_long',
      'formal_en',
      'name_alt',
      'name_sort',
      'formal_en',
      'brk_name'
    ]
    for idx, row in world_df.iterrows():
        for prop in name_props:
            value = row[prop]
            if value:
                nameToISOs[value] = row.iso_a2
    airport_to_country_code = {
        airport['_id']: nameToISOs[airport['countryName']]
        for airport in db.airports.find({})
    }
    return airport_to_country_code

def plot_airport(long_lat, rasterio_handle, out_raster, magnitude):
    """
    Plot the airport catchment weight function at the given
    longitude and latitude on the out_raster array
    using the transform specified by the rasterio_handle.
    The weight function has a zero to one value which is multiplied by
    the magnitude parameter.
    """
    # Pixel distance around airport where catchment portions will be computed.
    WINDOW_SIZE = (20, 20)
    # Distance decay functions and parameters from:
    # http://www.tsi.lv/sites/default/files/editor/science/Publikacii/RelStat_09/sess_8_pavlyuk.pdf
    a = -11.13
    b = 2.72
    row, col = np.array(rasterio_handle.index(*long_lat)).astype(int)
    for i in range(row - WINDOW_SIZE[0] / 2, row + WINDOW_SIZE[0] / 2):
        for j in range(col - WINDOW_SIZE[1] / 2, col + WINDOW_SIZE[1] / 2):

            distance_km = great_circle(
                long_lat[::-1],
                rasterio_handle.xy(i, j)[::-1]).kilometers
            value = magnitude / (1 + math.exp(a + b * math.log(distance_km, math.e)))
            out_raster[i % out_raster.shape[0], j % out_raster.shape[1]] += value


def create_projected_point(lon_lat):
    """
    Create a shaplely geometric point at the given longitude and latitude that
    is projected to cylindrical equal area coordinates.
    """
    return gpd.GeoDataFrame(
        crs={'init':'epsg:4326'},
        geometry=[shapely.geometry.Point(*lon_lat)]
    ).to_crs({'proj':'cea'}).geometry.iloc[0]


def create_location_shapes(resolved_location_tree, parent_shape=None):
    """
    Tranform a resolved value location tree into shapely geometric shapes
    that have values corresponding to their overall resolved value minus
    that of their contained shapes.
    """
    shapes = []
    for child in resolved_location_tree['children']:
        new_shape = None
        shape_value = None
        country_shape = None
        location = child['location']
        matching_countries = world_df[world_df.iso_a2 == location.get('countryCode', 'NoCountry')]
        excess_value = child['value'] - sum(child2['value'] for child2 in child['children'])
        # Excess value could be slightly negative due to floating point error.
        if excess_value < -0.01:
            print child
            print [child2['value'] for child2 in child['children']]
            raise Exception('Bad tree')
        excess_value = max(0, excess_value)
        if len(matching_countries):
            country_shape = matching_countries.geometry.iloc[0]
        if location.get('featureCode', '').startswith('PCL') and country_shape:
            new_shape = country_shape
        else:
            # Plot the location as a circle clipped by its containing location.
            lon_lat = location.get('longitude'), location.get('latitude')
            if lon_lat[0] and lon_lat[1]:
                # default area 10 square km
                shape_area = 10e3
                if len(matching_countries) and 'population' in location:
                    country_portion = float(location['population']) / matching_countries.pop_est.iloc[0]
                    shape_area = max(country_shape.area * country_portion, shape_area)
                new_shape = create_projected_point(lon_lat).buffer(math.sqrt(shape_area / math.pi))
                if parent_shape:
                    new_shape = new_shape.intersection(parent_shape)
                if new_shape.area == 0:
                    new_shape = None
        child_shapes = create_location_shapes(child, new_shape)
        child_shapes_out = []
        for child_shape_val in child_shapes:
            if child_shape_val[0] is None:
                # If the child location has no shape absorb it into the
                # parent location.
                excess_value += child_shape_val[1]
            else:
                child_shapes_out.append(child_shape_val)
        # # Remove overlapping child shape regions from parent shape.
        # if len(child_shapes_out) > 0:
        #     all_child_shape = child_shapes_out[0][0]
        #     for child_shape, value in child_shapes_out[1:]:
        #         all_child_shape = all_child_shape.union(child_shape)
        #     new_shape = new_shape.difference(all_child_shape)
        shapes.append((new_shape, excess_value,))
        shapes += child_shapes_out
    return shapes


def compute_case_raster(resolved_location_tree, population_raster, population_raster_data):
    """
    Convert a resolved value location tree into a raster map where the
    value of each pixel corresponds to the number of cases that occurred
    within it.
    """
    shape_values = create_location_shapes(resolved_location_tree)
    print "Removed cases:", sum([value
        for shape, value in shape_values
        if not(shape and shape.area > 0)])
    shape_values = [shape_value
        for shape_value in shape_values
        if shape_value[0] and shape_value[0].area > 0]
    projected_shapes = list(gpd.GeoDataFrame(
        crs={'proj':'cea'},
        geometry=[shape for shape, _ in shape_values]).to_crs({
            'init':'epsg:4326'
        }).geometry)
    case_raster = np.zeros(population_raster.shape)
    if len(shape_values) > 0:
        for projected_shape, (_, value) in zip(projected_shapes, shape_values):
            # There a couple options for combining sub-locations with their
            # parents. One is to limit sub-location desitys to the cases within
            # them, replacing the parent location pixels even when
            # they have a greater density.
            # The other is to add the sub-location densitys to the parent location
            # densitys. I think adding makes more sense because data for
            # sub-locations is likely to be more incomplete.
            mask = rasterio.features.rasterize(
                [(projected_shape, 1.0,)],
                out_shape=population_raster.shape,
                transform=population_raster.transform,
                all_touched=True)
            masked_pop = population_raster_data * mask
            case_raster += masked_pop * (value / (0.1 + masked_pop.sum()))
    return case_raster


def compute_outflows(db, match_query):
    """
    Compute the total outbound seats of each airports for flights matching the
    given query.
    """
    result = {}
    for pair in db.flights.aggregate([
        {
            "$match": match_query
        }, {
            '$group': {
                '_id': "$departureAirport",
                'totalSeats': {
                    '$sum': '$totalSeats'
                }
            }
        }
    ]):
        if pair['totalSeats'] > 0:
            result[pair['_id']] = pair['totalSeats']
    return result

if __name__ == "__main__":
    import os
    import requests

    population_raster = rasterio.open('gpw/gpw_v4_population_count_rev10_2015_15_min.tif')
    population_raster_data = population_raster.read(1)
    population_raster_data[population_raster_data < 0] = 0

    end_date = datetime.datetime(2016, 6, 1)
    start_date = datetime.datetime(2016, 7, 1)

    results = requests.get('https://eidr-connect.eha.io/api/events-with-resolved-data', params={
        'ids': ['C8cWLWrJhwHQohko5'],
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'eventType': 'auto',
        'fullLocations': True
    }).json()['events']
    db = pymongo.MongoClient(os.environ['MONGO_HOST'])['flirt']

    resolved_event_data = results[0]
    resolved_ccs = {}
    for child in resolved_event_data['fullLocations']['children']:
        cc = child['location']['countryCode']
        resolved_ccs[cc] = resolved_ccs.get(cc, 0) + child['value']
    resolved_event_data['locations'] = resolved_ccs
    case_raster = compute_case_raster(resolved_event_data['fullLocations'], population_raster, population_raster_data)
    print 'total cases:', case_raster.sum()
    actual_case_total = sum(child2['value'] for child2 in resolved_event_data['fullLocations']['children'])
    print 'error:', case_raster.sum() / actual_case_total
    save_image(case_raster ** 0.2, "case_raster")

    airport_to_country_code = get_airport_to_country_code(db)
    pops_by_cc = {
        row.iso_a2: row.pop_est
        for idx, row in world_df.iterrows()
        if row.iso_a2
    }

    outflows = compute_outflows(db, {
        "departureDateTime": {
            "$lte": end_date,
            "$gte": start_date
        }
    })
    max_outflow = max(outflows.values())

    all_airport_raster_data = np.zeros(population_raster.shape)
    for airport in list(db.airports.find()):
        magnitude = float(outflows.get(airport['_id'], 0)) / max_outflow
        if magnitude > 0:
            plot_airport(
                airport['loc']['coordinates'],
                population_raster, all_airport_raster_data,
                magnitude)
    save_image(all_airport_raster_data, "all_airport_raster")
    
    rows = []
    for airport in db.airports.find():
        result = np.zeros(population_raster_data.shape)
        magnitude = float(outflows.get(airport['_id'], 0)) / max_outflow
        if magnitude > 0:
            plot_airport(
                airport['loc']['coordinates'],
                population_raster, result,
                magnitude)
            result[all_airport_raster_data > 0] = result[all_airport_raster_data > 0] / all_airport_raster_data[all_airport_raster_data > 0]
            airport['catchment_cases'] = (result * case_raster).sum()
            airport['catchment_pop'] = (result * population_raster_data).sum()
            airport['simple_ratio'] = float(resolved_event_data['locations'].get(cc, 0)) / pops_by_cc[cc]
            rows.append(airport)

    df = pd.DataFrame(rows)
    df['prob_infected'] = df.catchment_cases / df.catchment_pop
    df = df.query('catchment_pop > 0')
    print df.sort_values('prob_infected')[['simple_ratio', 'prob_infected', 'name']]
