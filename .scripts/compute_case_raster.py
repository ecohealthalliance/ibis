import datetime
import pymongo
import pandas as pd
import math
import shapely
import geopandas as gpd
from rasterio import features
import rasterio
from PIL import Image, ImageDraw
import numpy as np
import matplotlib
matplotlib.use('PS')
import georasters as gr


base_raster = rasterio.open('gpw/gpw_v4_population_count_rev10_2015_15_min.tif')


world_df = gpd.read_file("../imports/geoJSON/world.geo.json")
# Use cylindrical equal-area projection
# https://gis.stackexchange.com/questions/218450/getting-polygon-areas-using-geopandas
world_df = world_df.to_crs({'proj': 'cea'})


def plot_airport(latLon, mag, georaster):
    WINDOW_SIZE = (10, 10)
    row, col = gr.map_pixel(
        latLon[0], latLon[1],
        georaster.x_cell_size, georaster.y_cell_size,
        georaster.xmin, georaster.ymax)
    # TODO:
    #mag / (1 + exp(a + b * ln(distance)))
    georaster.raster[row:row+WINDOW_SIZE[0], col:col+WINDOW_SIZE[1]] += mag


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
            location = child['location']
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
    case_per_m_raster = features.rasterize(
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

    #result = case_per_m_raster ** .2
    #Image.fromarray(np.array(255 * result / result.max(), dtype=np.uint8), 'L')


    AREA_OF_EARTH_M = 510.1e12
    STEP = 0.2
    lat_band_df = gpd.GeoDataFrame(crs={'init':'epsg:4326'}, geometry=[
        shapely.geometry.box(-180,i,180,i + STEP)
        for i in np.arange(-90, 90, STEP)
    ])
    lat_band_df = lat_band_df.to_crs({'proj':'cea'})
    lat_band_df['aream'] = lat_band_df.area
    lat_band_df = lat_band_df.to_crs({'init':'epsg:4326'})
    area_raster = features.rasterize(
        [(row.geometry, row.aream) for idx, row in lat_band_df.iterrows()],
        out_shape=base_raster.shape,
        transform=base_raster.transform)
    # Adjust area raster so the area of each pixel is equal to its value
    area_raster *= AREA_OF_EARTH_M / area_raster.sum()


    #Image.fromarray(np.array(255 * area_image / area_image.max(), dtype=np.uint8), 'L')


    case_raster = case_per_m_raster * area_raster
    print 'total cases:', case_raster.sum()
    actual_case_total = sum(child2['value'] for child2 in resolved_event_data['fullLocations']['children'])
    print 'error:', case_raster.sum() / actual_case_total


    #result = case_raster ** .2
    #Image.fromarray(np.array(255 * result / result.max(), dtype=np.uint8), 'L')


    return case_raster

if __name__ == "__main__":
    import os
    import requests

    population_gr = gr.from_file('gpw/gpw_v4_population_count_rev10_2015_15_min.tif')
    population_gr.raster[population_gr.raster <= 0] = 0
    #Image.fromarray(np.array(population_gr.raster / population_gr.raster.max() * 255, dtype=np.uint8), 'L')

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
    pops_by_cc = {
        row.iso_a2: row.pop_est
        for idx, row in world_df.iterrows()
        if row.iso_a2
    }


    for resolved_event_data in results:
        resolved_ccs = {}
        for child in resolved_event_data['fullLocations']['children']:
            cc = child['location']['countryCode']
            resolved_ccs[cc] = resolved_ccs.get(cc, 0) + child['value']
        resolved_event_data['locations'] = resolved_ccs
        case_raster = compute_case_raster(resolved_event_data)
        rows = []
        for airport in db.airports.find():
            airport_gr = gr.GeoRaster(
                np.zeros(population_gr.raster.shape),
                population_gr.geot)
            plot_airport(airport['loc']['coordinates'], 1.00, airport_gr)
            airport['catchment_cases'] = (airport_gr.raster * case_raster).sum()
            airport['catchment_pop'] = (airport_gr.raster * population_gr.raster).sum()
            airport['simple_ratio'] = float(resolved_event_data['locations'].get(cc, 0)) / pops_by_cc[cc]
            rows.append(airport)
        df = pd.DataFrame(rows)
        df['prob_infected'] = df.catchment_cases / df.catchment_pop
        # TODO Investigate
        df = df.query('catchment_pop > 0')
        print df.sort_values('prob_infected')[['simple_ratio', 'prob_infected', 'name']]
