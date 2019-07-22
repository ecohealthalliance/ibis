"""
Analyze how NBIC diseases were ranked by IBIS in the week they were reported.
"""
import pymongo
import os
import datetime
import requests


EIDR_C_HOST = os.environ.get('EIDR_C_HOST', 'https://eidr-connect.eha.io')

db = pymongo.MongoClient(os.environ["MONGO_HOST"])["nbic"]
flirt_db = pymongo.MongoClient(os.environ["MONGO_HOST"])["flirt"]

event_id_to_threat_coefficient = {}
for item in flirt_db.resolvedEvents.aggregate([
    {
        '$group': {
            '_id': '$eventId',
            'threatCoefficient': {
                '$first': '$threatCoefficient'
            }
        }
    }
]):
    event_id_to_threat_coefficient[item['_id']] = item['threatCoefficient']

disease_to_event_id = {}
event_to_disease_id = {}
events = requests.get(
    EIDR_C_HOST + '/api/auto-events',
    params={
        'limit': 20000,
        'query': '{}'}).json()
for event in events:
    disease_to_event_id[event['diseases'][0]['id']] = event['_id']
    event_to_disease_id[event['_id']] = event['diseases'][0]['id']

top_n_events = 0
top_n_events_filtered = 0
total_nbic_events = 0
nbic_disease_scores = []
other_disease_scores = []

for item in db.nbic.aggregate([
    { '$unwind': '$diseases' },
    {
        '$group': {
            '_id': { '$dateToString': { 'format': '%Y-%m-%d', 'date': '$date' } },
            'diseases': {
                '$addToSet': {
                    '$ifNull': ['$diseases.resolved.id', '$diseases.nameUsed'],
                }
            }
        }
    }
]):
    report_date = datetime.datetime.strptime(item['_id'], '%Y-%m-%d')
    rank_group = 'nbic-' + item['_id']
    ranked_events = list(flirt_db.pastEventAirportRanks.aggregate([{
        '$match': {
            'rankGroup': rank_group,
        }
    }, {
        '$group': {
            '_id': "$eventId",
            'rank': {
                '$sum': "$rank"
            },
        }
    }, {
        '$sort': {
            'rank': -1
        }
    }]))
    if len(ranked_events) == 0: continue
    print(item['_id'])
    event_to_rank = {}
    event_to_rank_score = {}
    for idx, ranked_event in enumerate(ranked_events):
        event_to_rank[ranked_event['_id']] = idx
        event_to_rank_score[ranked_event['_id']] = ranked_event['rank']
        if ranked_event['rank'] > 10000:
            print("Overly high rank: %s" % ranked_event['_id'])
    event_to_rank_filtered = {}
    filtered_ranked_events = [
        e for e in ranked_events
        if e['_id'] in event_id_to_threat_coefficient and event_id_to_threat_coefficient[e['_id']] > 0.25]
    for idx, ranked_event in enumerate(filtered_ranked_events):
        event_to_rank_filtered[ranked_event['_id']] = idx
        
    nbic_disease_scores += [
        rank_score for event, rank_score in event_to_rank_score.items()
        if event_to_disease_id.get(event) in item['diseases']]
    other_disease_scores += [
        rank_score for event, rank_score in event_to_rank_score.items()
        if event_to_disease_id.get(event) not in item['diseases']]
    
    
    for disease_id in item['diseases']:
        print(disease_id)
        total_nbic_events += 1
        event_id = disease_to_event_id.get(disease_id)
        if event_id in event_to_rank:
            print("rank: %s" % event_to_rank[event_id])
            if event_to_rank[event_id] < 10:
                top_n_events += 1
        else:
            print("unranked disease")
        if event_id in event_to_rank_filtered:
            print("rank (filtered): %s" % event_to_rank_filtered[event_id])
            if event_to_rank_filtered[event_id] < 10:
                top_n_events_filtered += 1

    
print()
print("NBIC events analyzed:")
print(total_nbic_events)
print("NBIC events ranked in top 10 by IBIS:")
print(top_n_events)
print("NBIC events ranked in top 10 by IBIS (excluding low priority):")
print(top_n_events_filtered)
print("Average Non-NBIC rank score:", sum(other_disease_scores) / len(other_disease_scores))
print("Average NBIC rank score:", sum(nbic_disease_scores) / len(nbic_disease_scores))

