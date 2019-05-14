import os
import json
import datetime
import celery
import tasks
import tornado.ioloop
import tornado.web
import tornado.httpclient
import dateutil.parser
import schema
from schema import Schema, Optional, Or
import pymongo


API_VERSION = "0.0.0"


db = pymongo.MongoClient(os.environ['MONGO_HOST'])['ibis']


def on_task_complete(task, callback):
    # if the task is a celery group with subtasks add them to the result set
    if hasattr(task, 'subtasks'):
        res_set = celery.result.ResultSet(task.subtasks)
    elif hasattr(task, 'parent'):
        res_set = celery.result.ResultSet([task])
        # If the task is a chain, the parent tasks need to be added to the result set
        # to catch failures in them.
        task_ptr = task
        while task_ptr.parent:
            task_ptr = task_ptr.parent
            res_set.add(task_ptr)
    else:
        res_set = celery.result.ResultSet([task])

    def check_celery_task():
        if res_set.ready() or res_set.failed():
            try:
                resp = task.get()
            except Exception as e:
                # When the debug parameter is passed in raise exceptions
                # instead of returning the error message.
                if 'args' in globals() and args.debug:
                    raise e
                # There is a bug in celery where exceptions are not properly marshaled
                # so the message is always "exceptions must be old-style classes or derived from BaseException, not dict"
                return callback(e, None)
            return callback(None, resp)
        else:
            tornado.ioloop.IOLoop.instance().add_timeout(
                datetime.timedelta(0, 1), check_celery_task
            )
    check_celery_task()

location_schema = Schema({
    Optional('area'): Or(float, int),
    'longitude': Or(float, int),
    'latitude': Or(float, int),
}, ignore_extra_keys=True)

location_tree_child_schema = Schema({
    'location': location_schema,
    'value': Or(float, int),
    Optional('children'): [lambda child: location_tree_child_schema.is_valid(child)]
})

param_schema = Schema({
    'rank_group': str,
    'active_case_location_tree': {
        'children': [location_tree_child_schema],
    },
    'start_date': str,
    Optional('end_date'): str
})


class ScoreHandler(tornado.web.RequestHandler):

    @tornado.web.asynchronous
    def post(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        parsed_args = tornado.escape.json_decode(self.request.body)
        param_schema.validate(parsed_args)
            
        def callback(err, resp):
            print('done')
            if err:
                result = {
                    'rank_group': parsed_args['rank_group'],
                    'error': repr(err)
                }
            else:
                result = {
                    'rank_group': parsed_args['rank_group'],
                    'complete': True
                }
            db.rankedUserEventStatus.insert(result)

        start_date = dateutil.parser.parse(parsed_args['start_date'])
        if 'end_date' in parsed_args:
            end_date = dateutil.parser.parse(parsed_args['end_date'])
        else:
            end_date = start_date + datetime.timedelta(14)
        task = tasks.score_airports_for_cases.apply_async(args=[
            parsed_args['active_case_location_tree'],
        ], kwargs=dict(
            start_date_p=start_date,
            end_date_p=end_date,
            sim_group_p='ibis14day',
            rank_group_p=parsed_args['rank_group']))
        self.set_header("Content-Type", "application/json")
        self.write({
            'result': 'started'
        })
        self.finish()
        on_task_complete(task, callback)


class VersionHandler(tornado.web.RequestHandler):
    def get(self):
        self.write(API_VERSION)
        self.finish()
    def post(self):
        return self.get()


application = tornado.web.Application([
    (r"/version", VersionHandler),
    (r"/score_bioevent", ScoreHandler)
])

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('-debug', action='store_true')
    args = parser.parse_args()
    if args.debug:
        # Run tasks in the current process so we don't have to run a worker
        # when debugging.
        tasks.celery_tasks.conf.update(
            CELERY_ALWAYS_EAGER = True,
        )
    application.listen(80)
    tornado.ioloop.IOLoop.instance().start()