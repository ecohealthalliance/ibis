from __future__ import print_function
import requests
import pymongo
import pandas as pd
import datetime
import os
from compute_case_raster import compute_case_raster, plot_airport, compute_outflows, get_airport_to_country_code
import rasterio
import numpy as np
import argparse
from dateutil import parser as date_parser

def batched(iterable, batch_size=10):
    """
    Sequentially yield segments of the iterable in lists of the given size.
    """
    batch = []
    for idx, item in enumerate(iterable):
        batch.append(item)
        batch_idx = idx % batch_size
        if batch_idx == batch_size - 1:
            yield batch
            batch = []
    if batch:
      yield batch

def compute_airport_flow_matrix(sim_group):
    passenger_flows = list(db.passengerFlows.find({
        'simGroup': sim_group
    }))
    if len(passenger_flows) == 0:
        raise Exception("No passenger flows found.")
    airport_set = set()
    for flow in passenger_flows:
        airport_set.add(flow['arrivalAirport'])
        airport_set.add(flow['departureAirport'])
    airport_to_idx = {}
    for idx, airport in enumerate(airport_set):
        airport_to_idx[airport] = idx
    flow_matrix = np.zeros(shape=(len(airport_set), len(airport_set)))
    for flow in passenger_flows:
        flow_matrix[
            airport_to_idx[flow['departureAirport']],
            airport_to_idx[flow['arrivalAirport']]] = flow['estimatedPassengers']
    return flow_matrix, airport_to_idx

def resolved_event_iter(events, start_date, end_date, only_use_sources_before_end_date):
    for event_batch in batched(events, 1):
        params = {
            'ids': [event['_id'] for event in event_batch],
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
            'eventType': 'auto',
            'fullLocations': True,
            'activeCases': True
        }
        if only_use_sources_before_end_date:
            params['onlyUseSourcesBeforeEndDate'] = True
        url = EIDR_C_HOST + '/api/events-with-resolved-data'
        request_result = requests.get(url, params=params, headers={
            # For unknown reasons, using the accept encoding header causes proxy errors
            # when the API takes a long time to respond.
            'Accept-Encoding': None})
        request_result.raise_for_status()
        try:
            results = request_result.json()['events']
        except:
            print("Bad response:")
            print(request_result.content)
            raise
        for result in results:
            yield result

CLASSIFICATION_COEFFICIENT_MAP = {
    'low': 0.125,
    'medium': 0.25,
    'high': 0.5,
    'very high': 1.0,
}

def get_classification_coefficient(classification):
    classification = classification.lower()
    partial_coefficients = []
    for partial_classification in classification.split('to'):
        for possible_classification in ['very high', 'high', 'medium', 'low']:
            if possible_classification in partial_classification:
                partial_coefficients.append(CLASSIFICATION_COEFFICIENT_MAP[possible_classification])
                break
    if partial_coefficients:
        return sum(partial_coefficients) / len(partial_coefficients)
    else:
        return 0

def traverse_location_tree(node, resolved_ccs):
    for child in node.get('children', []):
        cc = child['location'].get('countryCode')
        if cc:
            resolved_ccs[cc] = resolved_ccs.get(cc, 0) + child['value']
        else:
            traverse_location_tree(child, resolved_ccs)
    return resolved_ccs

db = pymongo.MongoClient(os.environ['MONGO_HOST'])['flirt']

EIDR_C_HOST = os.environ.get('EIDR_C_HOST', 'https://eidr-connect.eha.io')

print("Loading population data...")
population_raster = rasterio.open("gpw/gpw_v4_population_count_rev10_2015_15_min.tif")
population_raster_data = population_raster.read(1)
population_raster_data[population_raster_data < 0] = 0
print("\tPopulation raster sum:", population_raster_data.sum())

def rank_events(
    start_date_p=None,
    end_date_p=None,
    sim_group_p=None,
    rank_group_p=None,
    event_id_p=None,
    only_use_sources_before_end_date=False):
    processing_start_date = datetime.datetime.now()
    print("Evaluation Started: " + str(processing_start_date))
    
    print("Downloading Events...")
    query = '{}'
    if event_id_p:
        print(event_id_p)
        query = '{ "_id": "' + event_id_p + '" }'
    events = requests.get(
        EIDR_C_HOST + '/api/auto-events',
        params={
            'limit': 20000,
            'query': query}).json()
    print("\t%s events found." % len(events))
    
    print("Downloading passenger flows...")
    flow_matrix, airport_to_idx = compute_airport_flow_matrix(sim_group_p)
    print("\tFlows for %s airports found." % len(airport_to_idx))

    print("Resolving events...")
    events_with_resolved_data = list(zip(events, resolved_event_iter(
        events, start_date_p, end_date_p, only_use_sources_before_end_date)))
    print("\t%s events with resolved data." % len([
        event for event, resolved_data in events_with_resolved_data
        if len(resolved_data['fullLocations']['children']) > 0]))
    # Verify that resolved event order matches up with the original order.
    for event, resolved_event_data in events_with_resolved_data:
        assert event['_id'] == resolved_event_data['eventId']

    print("Computing outflows...")
    outflows = compute_outflows(db, {
        'departureDateTime': {
            '$lte': end_date_p,
            '$gte': start_date_p
        }
    })
    max_outflow = max(outflows.values())
    print("\tMax outflow:", max_outflow)
    
    print("Computing all airport raster...")
    all_airport_raster_data = np.zeros(population_raster.shape)
    for airport in list(db.airports.find()):
        magnitude = float(outflows.get(airport['_id'], 0)) / max_outflow
        if magnitude > 0:
            plot_airport(
                airport['loc']['coordinates'],
                population_raster, all_airport_raster_data,
                magnitude)
    print("\tDone.")

    print("Computing probabilities of passengers being infected")
    cases_in_catchment_matrix = np.zeros(shape=(len(events), len(airport_to_idx)))
    catchment_population_matrix = np.zeros(shape=(len(events), len(airport_to_idx)))
    for idx, (event, resolved_event_data) in enumerate(events_with_resolved_data):
        resolved_location_tree = resolved_event_data['fullLocations']
        if sum(child2['value'] for child2 in resolved_location_tree['children']) == 0:
            continue
        print('\n')
        print(event['eventName'])
        case_raster = compute_case_raster(
            resolved_location_tree,
            population_raster,
            population_raster_data)
        print('total cases:', case_raster.sum())
        actual_case_total = sum(child2['value'] for child2 in resolved_event_data['fullLocations']['children'])
        print('error:', 100.0 * (case_raster.sum() / actual_case_total - 1.0), "%")
        for airport in db.airports.find():
            result = np.zeros(population_raster_data.shape)
            airport_id = airport['_id']
            magnitude = float(outflows.get(airport_id, 0)) / max_outflow
            if magnitude > 0 and airport_id in airport_to_idx:
                plot_airport(
                    airport['loc']['coordinates'],
                    population_raster, result,
                    magnitude)
                result[all_airport_raster_data > 0] =\
                    result[all_airport_raster_data > 0] /\
                    all_airport_raster_data[all_airport_raster_data > 0]
                cases_in_catchment_matrix[idx, airport_to_idx[airport_id]] = (
                    result * case_raster).sum()
                catchment_population_matrix[idx, airport_to_idx[airport_id]] = (
                    result * population_raster_data).sum()
    print("\tDone.")
    
    print("Computing cases by country...")
    for idx, (event, resolved_event_data) in enumerate(events_with_resolved_data):
        resolved_ccs = traverse_location_tree(resolved_event_data['fullLocations'], {})
        resolved_event_data['locations'] = resolved_ccs
        if len(resolved_ccs) == 0 and len(resolved_event_data['fullLocations']['children']) > 0:
            print("Could not resolve country code.")
            print(event['eventName'])
            print(resolved_event_data)
    print("\tDone.")
    
    print("Computing disease severity coefficients...")
    df = pd.read_csv(os.path.join(os.path.dirname(os.path.realpath(__file__)), "curated-disease-data.csv"))
    disease_uri_to_classification_coefficient = {}
    for idx, row in df.iterrows():
        if not pd.isnull(row['uri']) and not pd.isnull(row['Classification']):
            classification = row['Classification']
            disease_uri_to_classification_coefficient[row['uri']] = get_classification_coefficient(classification)
    
    print("Storing resolved event data...")
    if rank_group_p:
        db.pastResolvedEvents.delete_many({
            'rankGroup': rank_group_p
        })
        for idx, (event, resolved_event) in enumerate(events_with_resolved_data):
            db.pastResolvedEvents.insert_one(dict(
                resolved_event,
                threatCoefficient=disease_uri_to_classification_coefficient.get(
                    event['diseases'][0]['id'],
                    0.5),
                rankGroup=rank_group_p,
                eventId=event['_id'],
                name=event['eventName'],
                timestamp=datetime.datetime.now()))
        db.pastResolvedEvents.create_index("eventId")
    elif event_id_p:
        db.resolvedEvents.delete_many({ 'eventId': event_id_p })
        for idx, (event, resolved_event) in enumerate(events_with_resolved_data):
            db.resolvedEvents.insert_one(dict(
                resolved_event,
                threatCoefficient=disease_uri_to_classification_coefficient.get(
                    event['diseases'][0]['id'],
                    0.5),
                _id=event['_id'],
                name=event['eventName'],
                timestamp=datetime.datetime.now()))
    else:
        # Drop collection in case it still exists from a failed prior run.
        db.resolvedEvents_create.drop()
        for idx, (event, resolved_event) in enumerate(events_with_resolved_data):
            db.resolvedEvents_create.insert_one(dict(
                resolved_event,
                threatCoefficient=disease_uri_to_classification_coefficient.get(
                    event['diseases'][0]['id'],
                    0.5),
                _id=event['_id'],
                name=event['eventName'],
                timestamp=datetime.datetime.now()))
    print("\tDone.")
    
    # Determine DALYs Per case using GBD data.
    # Citation:
    # Global Burden of Disease Collaborative Network.
    # Global Burden of Disease Study 2016 (GBD 2016) Results.
    # Seattle, United States: Institute for Health Metrics and Evaluation (IHME), 2017.
    # Available from http://ghdx.healthdata.org/gbd-results-tool?params=gbd-api-2016-permalink/4ef232ed16d847a5cad84132845b2af7
    import epitator
    from epitator.database_interface import DatabaseInterface
    epitator_db = DatabaseInterface()
    df = pd.read_csv(os.path.join(os.path.dirname(os.path.realpath(__file__)), "IHME-GBD_2016_DATA.csv"))
    formatted_df = df[df.year > 2000]\
        .groupby(['cause', 'measure']).mean().reset_index()\
        .pivot(index='cause', columns='measure', values='val').reset_index()
    # Incidence rather than prevalance is used because it, like DALYs, gives a annual rate.
    # The DALYs for a given year can come from cases that occurred in previous years,
    # and the temporal offset is dependent on the disease. To reduce the effects
    # of this descrepancy the annual rates are averaged over the a 10-20 year period.
    formatted_df['ratio'] =\
        formatted_df['DALYs (Disability-Adjusted Life Years)'] /\
        formatted_df['Incidence']
    formatted_df.sort_values('ratio')
    # Get total DALYs per case for top level disease categories
    totals = formatted_df[formatted_df.cause.isin([
        'Sexually transmitted diseases excluding HIV',
        'HIV/AIDS and tuberculosis',
        'Diarrhea, lower respiratory, and other common infectious diseases',
        'Neglected tropical diseases and malaria'])].sum()
    average_DALYs_per_case = totals['DALYs (Disability-Adjusted Life Years)'] / totals['Incidence']
    print("\tAverage DALYs per case:", average_DALYs_per_case)
    
    def valid_ratio(x):
        return not(pd.isna(x) or x > 100)
    
    name_mappings = {
        'Acute hepatitis A': 'hepatitis A',
        'Acute hepatitis E': 'hepatitis E',
        'Cutaneous and mucocutaneous leishmaniasis': 'leishmaniasis',
        'Diarrheal diseases': 'diarrhea',
        'Food-borne trematodiases': 'trematodiases',
        'HIV/AIDS': 'hiv',
        'Hookworm disease': 'Hookworm',
        'Latent tuberculosis infection': 'tuberculosis',
        'Varicella and herpes zoster': 'Varicella',
    }
    
    disease_uri_to_DALYs_per_case = {}
    for idx, x in formatted_df.iterrows():
        cause = x['cause']
        if cause in name_mappings:
            cause = name_mappings[cause]
        disease_ent = next(epitator_db.lookup_synonym(cause, 'disease'), None)
        if disease_ent:
            disease_uri_to_DALYs_per_case[disease_ent['id']] =\
                disease_uri_to_DALYs_per_case.get(disease_ent['id'], []) + [{
                    'label': disease_ent['label'],
                    'DALYsPerCase': x['ratio'] if valid_ratio(x['ratio']) else average_DALYs_per_case,
                    'weight': disease_ent['weight']
                }]
        else:
            print("Unresolved: " + x['cause'])
    disease_uri_to_DALYs_per_case = {
        k: max(v, key=lambda x: x['weight'])['DALYsPerCase']
        for k, v in disease_uri_to_DALYs_per_case.items()
    }
    print("\tDone.")
    
    print("Inserting rank data...")
    airport_to_country_code = get_airport_to_country_code(db)
    
    def gen_ranks():
        for idx, (event, resolved_event) in enumerate(events_with_resolved_data):
            event_id = event['_id']
            DALYs_per_case = disease_uri_to_DALYs_per_case.get(
                event['diseases'][0]['id'],
                average_DALYs_per_case)
            threat_coefficient = disease_uri_to_classification_coefficient.get(
                event['diseases'][0]['id'],
                0.0625)
            for arrival_airport, arrival_country_code in airport_to_country_code.items():
                if arrival_airport not in airport_to_idx:
                    continue
                arrival_airport_idx = airport_to_idx[arrival_airport]
                for departure_airport, departure_country_code in airport_to_country_code.items():
                    if departure_airport not in airport_to_idx:
                        continue
                    dep_airport_idx = airport_to_idx[departure_airport]
                    passenger_flow = flow_matrix[dep_airport_idx, arrival_airport_idx]
                    cases_in_catchment = cases_in_catchment_matrix[idx, dep_airport_idx]
                    catchment_population = catchment_population_matrix[idx, dep_airport_idx]
                    if catchment_population == 0:
                        probability_passenger_infected = 0
                    else:
                        probability_passenger_infected =\
                            float(cases_in_catchment) / catchment_population
                    rank_score = probability_passenger_infected * passenger_flow * threat_coefficient
                    if not(rank_score > 0):
                        rank_score = 0
                    # Airports with a low probability of having an infected passenger are skipped
                    # to reduce the collection size.
                    if not(passenger_flow > 0) or not(probability_passenger_infected > 1E-9):
                        continue
                    yield {
                        'eventId': event_id,
                        'departureAirportId': departure_airport,
                        'arrivalAirportId': arrival_airport,
                        'catchmentPopulation': catchment_population,
                        'probabilityPassengerInfected': probability_passenger_infected,
                        'passengerFlow': passenger_flow,
                        'threatCoefficient': threat_coefficient,
                        'DALYsPerCase': DALYs_per_case,
                        'rank': rank_score
                    }
    
    if rank_group_p:
        db.pastEventAirportRanks.delete_many({
            'rankGroup': rank_group_p
        })
        for ranks in batched(gen_ranks(), 50000):
            for rank in ranks:
                rank['rankGroup'] = rank_group_p
            result = db.pastEventAirportRanks.insert_many(ranks)
            print(len(result.inserted_ids), '/', len(ranks), 'records inserted')
        print("\tDone.")
    
        print("Print first rank for spot checking:")
        first_rank = db.pastEventAirportRanks.find_one({
            'rankGroup': rank_group_p,
            'rank': {'$gt': 0}
        })
        assert first_rank
        print(first_rank)
        db.pastEventAirportRanks.create_index("rankGroup")
        db.pastEventAirportRanks.create_index("eventId")
    elif event_id_p:
        db.eventAirportRanks.delete_many({
            'eventId': event_id_p
        })
        for ranks in batched(gen_ranks(), 50000):
            result = db.eventAirportRanks.insert_many(ranks)
            print(len(result.inserted_ids), '/', len(ranks), 'records inserted')
    else:
        # Drop collection in case it still exists from a failed prior run.
        db.eventAirportRanks_create.drop()
        for ranks in batched(gen_ranks(), 50000):
            result = db.eventAirportRanks_create.insert_many(ranks)
            print(len(result.inserted_ids), '/', len(ranks), 'records inserted')
        db.eventAirportRanks_create.rename("eventAirportRanks", dropTarget=True)
        print("\tDone.")
    
        print("Print first rank for spot checking:")
        first_rank = db.eventAirportRanks.find_one({
            'rank': {'$gt': 0}
        })
        assert first_rank
        print(first_rank)
        db.eventAirportRanks.create_index("eventId")
        print("Replace old resolved events collection")
        db.resolvedEvents_create.rename("resolvedEvents", dropTarget=True)
        db.resolvedEvents.create_index("eventId")
    
    db.rankEvaluationMetadata.insert_one({
        'start': processing_start_date,
        'finish': datetime.datetime.now(),
        'numEvents': len(events),
        'rankGroup': rank_group_p,
        'eventId': event_id_p
    })
    
    print("Finished at: " + str(datetime.datetime.now()))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start_date", default=None)
    parser.add_argument("--end_date", default=None)
    parser.add_argument("--sim_group", default="ibis14day")
    parser.add_argument("--rank_group", default=None)
    parser.add_argument("--event_id", default=None)
    parser.add_argument("--only_use_sources_before_end_date", default=False, action='store_true')
    args = parser.parse_args()

    if args.event_id and args.rank_group:
        print("The event id and rank group parameters cannot be used together")
    else:
        if args.end_date:
            end_date = date_parser.parse(args.end_date)
        else:
            end_date = datetime.datetime.now()
        if args.start_date:
            start_date = date_parser.parse(args.start_date)
        else:
            start_date = end_date - datetime.timedelta(days=14)
        rank_events(
            start_date_p=start_date,
            end_date_p=end_date,
            sim_group_p=args.sim_group,
            rank_group_p=args.rank_group,
            event_id_p=args.event_id,
            only_use_sources_before_end_date=args.only_use_sources_before_end_date)

    # Tell IBIS to update its caches since the data has been updated.
    resp = requests.get("http://ibis.eha.io/api/clearCaches")
    resp.raise_for_status()
