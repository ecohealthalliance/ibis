from rank_events import rank_events
import pymongo
import os
import datetime

db = pymongo.MongoClient(os.environ["MONGO_HOST"])["nbic"]


for item in db.nbic.aggregate([
    {
        '$group': {
            '_id': { '$dateToString': { 'format': '%Y-%m-%d', 'date': '$date' } }
        }
    }, {
        '$sort': { '_id': 1 }
    }
]):
    if item['_id'] in ["2018-02-05", "nbic-2017-06-12"]:
        continue
    report_date = datetime.datetime.strptime(item['_id'], '%Y-%m-%d')
    if report_date < datetime.datetime(2017,6,1):
        continue
    rank_events(
        start_date_p=report_date - datetime.timedelta(7),
        end_date_p=report_date,
        sim_group_p=report_date.strftime('gtq-%Y-%m'),
        rank_group_p="nbic-" + item['_id'],
        only_use_sources_before_end_date=True
    )
