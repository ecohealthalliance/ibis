from __future__ import print_function
import requests
import logging
import datetime
import os


IBIS_URL = os.environ.get("IBIS_URL", "http://ibis.eha.io")


def logged_request(url, **kwargs):
    print("\tMaking request to " + url)
    start_time = datetime.datetime.now() 
    resp = requests.get(IBIS_URL + url, **kwargs)
    print("\tFinished in ", datetime.datetime.now() - start_time)
    resp.raise_for_status()
    return resp.json()


def assert_eq(a, b):
    if a != b:
        raise Exception("Values are not equal:\n%s, %s" % (a, b,))

def assert_in(a, b):
    if a not in b:
        raise Exception("%s is not in %s" % (a, b,))

all_locations = logged_request('/api/topLocations', params={
    'metric': 'threatLevelExposure'
})
bioevents = logged_request('/api/bioevents', params={
    'metric': 'threatLevel'
})
print("Comparing the combined rank for all locations with the combined rank for the top bioevents...")
combined_airport_rank = sum(all_locations[u'airportValues'].values())
combined_bioevent_rank = sum(result['rank'] for result in bioevents['results'])
print(combined_airport_rank, combined_bioevent_rank)
assert combined_bioevent_rank < combined_airport_rank
assert combined_bioevent_rank > 0.7 * combined_airport_rank
top_bioevent = bioevents['results'][0]
top_bioevent_data = logged_request('/api/bioevents/' + top_bioevent['_id'], params={
    'metric': 'threatLevelExposure'
})
print("Top bioevent:", top_bioevent['event']['name'])
top_airport, value = sorted(top_bioevent_data['airportValues']['threatLevelExposure'].items(), key=lambda x: x[1])[-1]
print("Top airport for top bioevent:", top_airport)
print("""Verifying that the global top bioevent also appears as one of the top bioevents for the
location with the greatest threat exposure from it...""")
bioevents_for_location = logged_request('/api/locations/airport:' + top_airport + '/bioevents', params={
    'metric': 'threatLevel'
})['results']
assert_in(top_bioevent['_id'], [x['_id'] for x in bioevents_for_location])
print("Verifying that the timeseries is non-zero for the top bioevent...")
assert any(value > 0 for date, value in top_bioevent_data['resolvedBioevent']['timeseries'])
last_update_date = datetime.datetime.strptime(logged_request('/api/bioeventLastUpdate')['value'], '%Y-%m-%dT%H:%M:%S.%fZ')
days_since_update = (datetime.datetime.now() - last_update_date).total_seconds() / 60 / 60 / 24
print("Days since update:", days_since_update)
assert days_since_update < 15
top_bioevent_rank_data = logged_request('/api/rankData', params={
    'eventId': top_bioevent['_id']
})
print("Verifying that the detailed rank data matches the overview data...")
assert_eq(top_bioevent_rank_data['combinedValues']['rank'], top_bioevent['rank'])
