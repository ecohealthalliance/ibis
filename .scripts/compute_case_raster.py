import datetime
import pymongo
import pandas as pd
import math
import shapely
import geopandas as gpd
import rasterio
import rasterio.features
import PIL.Image
import numpy as np
from geopy.distance import great_circle
import matplotlib

matplotlib.use('PS')

def save_image(raster, name):
    img = PIL.Image.fromarray(np.array(255 * raster / raster.max(), dtype=np.uint8))
    img.save(name + ".png", "PNG")

base_raster = rasterio.open('gpw/gpw_v4_population_count_rev10_2015_15_min.tif')


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


AREA_OF_EARTH_M = 510.1e12
STEP = 0.2
lat_band_df = gpd.GeoDataFrame(crs={'init':'epsg:4326'}, geometry=[
    shapely.geometry.box(-180,i,180,i + STEP)
    for i in np.arange(-90, 90, STEP)
])
lat_band_df = lat_band_df.to_crs({'proj':'cea'})
lat_band_df['aream'] = lat_band_df.area
lat_band_df = lat_band_df.to_crs({'init':'epsg:4326'})
area_raster = rasterio.features.rasterize(
    [(row.geometry, row.aream) for idx, row in lat_band_df.iterrows()],
    out_shape=base_raster.shape,
    transform=base_raster.transform)
# Adjust area raster so the area of each pixel is its value
area_raster *= AREA_OF_EARTH_M / area_raster.sum()
save_image(area_raster, "area_raster")

def plot_airport(long_lat, georaster, out_raster, magnitude):
    WINDOW_SIZE = (20, 20)
    row, col = np.array(georaster.index(*long_lat)).astype(int)
    for i in range(row - WINDOW_SIZE[0] / 2, row + WINDOW_SIZE[0] / 2):
        for j in range(col - WINDOW_SIZE[1] / 2, col + WINDOW_SIZE[1] / 2):
            # Distance decay functions and parameters from:
            # http://www.tsi.lv/sites/default/files/editor/science/Publikacii/RelStat_09/sess_8_pavlyuk.pdf
            a = -11.13
            b = 2.72
            distance_km = great_circle(long_lat[::-1], georaster.xy(i, j)[::-1]).kilometers
            value = magnitude / (1 + math.exp(a + b * math.log(distance_km, math.e)))
            out_raster[i % out_raster.shape[0], j % out_raster.shape[1]] += value


def create_projected_point(lon_lat):
    # https://gis.stackexchange.com/questions/127427/transforming-shapely-polygon-and-multipolygon-objects
    return gpd.GeoDataFrame(
        crs={'init':'epsg:4326'},
        geometry=[shapely.geometry.Point(*lon_lat)]
    ).to_crs({'proj':'cea'}).geometry.iloc[0]


def create_location_shapes(location_tree, parent_shape=None):
    shapes = []
    for child in location_tree['children']:
        new_shape = None
        shape_value = None
        country_shape = None
        location = child['location']
        matching_countries = world_df[world_df.iso_a2 == location.get('countryCode', 'NoCountry')]
        excess_value = child['value'] - sum(child2['value'] for child2 in child['children'])
        if len(matching_countries):
            country_shape = matching_countries.geometry.iloc[0]
        if location.get('featureCode', '').startswith('PCL') and country_shape:
            new_shape = country_shape
            shape_value = excess_value / new_shape.area
        else:
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
                shape_value = excess_value / new_shape.area
        if new_shape:
            shapes.append((new_shape, shape_value,))
        shapes += create_location_shapes(child, new_shape)
    return shapes


def compute_case_raster(resolved_event_data):
    shapes = create_location_shapes(resolved_event_data['fullLocations'])
    if len(shapes) > 0:
        case_per_m_raster = rasterio.features.rasterize(
            zip(
                list(gpd.GeoDataFrame(
                    crs={'proj':'cea'},
                    geometry=[s[0] for s in shapes]).to_crs({
                        'init':'epsg:4326'
                    }).geometry),
                [s[1] for s in shapes]
            ),
            out_shape=base_raster.shape,
            transform=base_raster.transform)
    
        case_raster = case_per_m_raster * area_raster
        print 'total cases:', case_raster.sum()
        actual_case_total = sum(child2['value'] for child2 in resolved_event_data['fullLocations']['children'])
        print 'error:', case_raster.sum() / actual_case_total
    return case_raster


def compute_outflows(db, match_query):
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

    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=300)
    results = requests.get('https://eidr-connect.eha.io/api/events-with-resolved-data', params={
        'ids': ['jqrHoSTJa687S5cqs'],
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'eventType': 'auto',
        'fullLocations': True
    }).json()['events']

    db = pymongo.MongoClient(os.environ['MONGO_HOST'])['flirt']

    airport_to_country_code = get_airport_to_country_code(db)
    pops_by_cc = {
        row.iso_a2: row.pop_est
        for idx, row in world_df.iterrows()
        if row.iso_a2
    }

    outflows = compute_outflows(db, {
        "departureDateTime": {
            "$lte": datetime.datetime(2016, 7, 1),
            "$gte": datetime.datetime(2016, 6, 1)
        }
    })
    max_outflow = max(outflows.values())

    population_raster = rasterio.open("gpw/gpw_v4_population_count_rev10_2015_15_min.tif")
    population_raster_data = population_raster.read(1)
    population_raster_data[population_raster_data < 0] = 0
    all_airport_raster_data = np.zeros(population_raster.shape)
    for airport in list(db.airports.find()):
        magnitude = float(outflows.get(airport['_id'], 0)) / max_outflow
        if magnitude > 0:
            plot_airport(
                airport['loc']['coordinates'],
                population_raster, all_airport_raster_data,
                magnitude)


    for resolved_event_data in results:
        resolved_ccs = {}
        for child in resolved_event_data['fullLocations']['children']:
            cc = child['location']['countryCode']
            resolved_ccs[cc] = resolved_ccs.get(cc, 0) + child['value']
        resolved_event_data['locations'] = resolved_ccs
        case_raster = compute_case_raster(resolved_event_data)
        save_image(case_raster ** .2, "case_raster")
        
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
