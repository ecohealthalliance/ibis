from __future__ import absolute_import
from __future__ import print_function
import datetime
import os
import sys
import numpy as np
from celery import Celery


initial_run_for_worker = True


celery_tasks = Celery('tasks', broker=os.environ.get('BROKER_URL'))

celery_tasks.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    result_backend=os.environ.get('BROKER_URL'),
)

@celery_tasks.task
def score_airports_for_cases(
    active_case_location_tree,
    start_date_p=None,
    end_date_p=None,
    sim_group_p=None,
    rank_group_p=None):
    if start_date_p:
        start_date_p = datetime.datetime.strptime(start_date_p, "%Y-%m-%dT%H:%M:%S.%f")
    if end_date_p:
        end_date_p = datetime.datetime.strptime(end_date_p, "%Y-%m-%dT%H:%M:%S.%f")
    global initial_run_for_worker
    global compute_case_raster
    global plot_airport
    global compute_outflows
    global compute_airport_flow_matrix
    global db
    global population_raster
    global population_raster_data
    global traverse_location_tree
    global get_airport_to_country_code
    if initial_run_for_worker:
        initial_run_for_worker = False
        sys.path.append(os.getcwd())
        from rank_events import (
            compute_case_raster,
            plot_airport,
            compute_outflows,
            compute_airport_flow_matrix,
            db,
            population_raster,
            population_raster_data,
            traverse_location_tree,
            get_airport_to_country_code)
    if sum(child2['value'] for child2 in active_case_location_tree['children']) == 0:
        raise Exception('No cases')
    flow_matrix, airport_to_idx = compute_airport_flow_matrix(sim_group_p)

    outflows = compute_outflows(db, {
        'departureDateTime': {
            '$lte': end_date_p,
            '$gte': start_date_p
        }
    })
    if len(outflows) == 0:
        print(start_date_p)
        print(end_date_p)
        raise Exception('No outflows found.')
    max_outflow = max(outflows.values())
    print("Max outflow:", max_outflow)

    all_airport_raster_data = np.zeros(population_raster.shape)
    for airport in list(db.airports.find()):
        magnitude = float(outflows.get(airport['_id'], 0)) / max_outflow
        if magnitude > 0:
            plot_airport(
                airport['loc']['coordinates'],
                population_raster, all_airport_raster_data,
                magnitude)
    print("Airports plotted")

    case_raster = compute_case_raster(
        active_case_location_tree,
        population_raster,
        population_raster_data)
    print('Total cases:', case_raster.sum())

    cases_in_catchment_by_airport = np.zeros(len(airport_to_idx))
    catchment_population_by_airport = np.zeros(len(airport_to_idx))
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
            cases_in_catchment_by_airport[airport_to_idx[airport_id]] = (
                result * case_raster).sum()
            catchment_population_by_airport[airport_to_idx[airport_id]] = (
                result * population_raster_data).sum()

    airport_to_country_code = get_airport_to_country_code(db)
    ranks = []
    for arrival_airport, arrival_country_code in airport_to_country_code.items():
        if arrival_airport not in airport_to_idx:
            continue
        arrival_airport_idx = airport_to_idx[arrival_airport]
        for departure_airport, departure_country_code in airport_to_country_code.items():
            if departure_airport not in airport_to_idx:
                continue
            dep_airport_idx = airport_to_idx[departure_airport]
            passenger_flow = flow_matrix[dep_airport_idx, arrival_airport_idx]
            cases_in_catchment = cases_in_catchment_by_airport[dep_airport_idx]
            catchment_population = catchment_population_by_airport[dep_airport_idx]
            if catchment_population == 0:
                probability_passenger_infected = 0
            else:
                probability_passenger_infected =\
                    float(cases_in_catchment) / catchment_population
            rank_score = probability_passenger_infected * passenger_flow
            if not(rank_score > 0):
                rank_score = 0
            if not(passenger_flow > 0) or not(probability_passenger_infected > 1E-9):
                continue
            ranks.append({
                'rankGroup': rank_group_p,
                'departureAirportId': departure_airport,
                'arrivalAirportId': arrival_airport,
                'catchmentPopulation': catchment_population,
                'probabilityPassengerInfected': probability_passenger_infected,
                'passengerFlow': passenger_flow,
                'rank': rank_score
            })

    db.userAirportRanks.insert_many(ranks)
    return len(ranks)

if __name__ == "__main__":
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=14)
    active_case_location_tree = {
        'location': 'ROOT',
        'children': [{
            'location': {
                'longitude': 30.14452,
                'latitude': -6.44596,
                'population': 10000,
            },
            'value': 4.182193023555321}]}
    rank_user_counts(
        active_case_location_tree,
        start_date_p=start_date.isoformat(),
        end_date_p=end_date.isoformat(),
        sim_group_p="ibis14day",
        rank_group_p="test")
