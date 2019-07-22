from score_api.rank_events import rank_events
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
    report_date = datetime.datetime.strptime(item['_id'], '%Y-%m-%d')
    if report_date < datetime.datetime(2019,1,1) and not(report_date < datetime.datetime(2017, 12, 5) and report_date > datetime.datetime(2017, 12, 1)):
        continue
    print("Report Date: %s" % report_date)
    rank_events(
        start_date_p=report_date - datetime.timedelta(7),
        end_date_p=report_date,
        sim_group_p=report_date.strftime('gtq-%Y-%m'),
        rank_group_p="nbic-" + item['_id'],
        only_use_sources_before_end_date=True
    )
