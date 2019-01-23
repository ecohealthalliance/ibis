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


disease_to_event_id = {}
events = requests.get(
    EIDR_C_HOST + '/api/auto-events',
    params={
        'limit': 20000,
        'query': '{}'}).json()
for event in events:
    disease_to_event_id[event['diseases'][0]['id']] = event['_id']

top_n_events = 0
total_nbic_events = 0

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
    for idx, ranked_event in enumerate(ranked_events):
        event_to_rank[ranked_event['_id']] = idx
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

print("")
print("NBIC events analyzed:")
print(total_nbic_events)
print("NBIC events ranked in top 10 by IBIS:")
print(top_n_events)
