import logging
import os
import requests
import json
import datetime
import celery
import tasks
import tornado.ioloop
import tornado.web
import tornado.httpclient
import tornado.options
import dateutil.parser
import schema
from schema import Schema, Optional, Or, SchemaError
import pymongo
from location_tree import LocationTree

API_VERSION = "0.0.0"

db = pymongo.MongoClient(os.environ['MONGO_HOST'])['ibis']


def flatten_tree(tree_node):
    """
    Create a list of all the tree's nodes excluding ROOT.
    """
    if not tree_node.get('location') or tree_node['location'] == 'ROOT':
        result = []
    else:
        result = [tree_node]
    for node in tree_node.get('children', []):
        result += flatten_tree(node)
    return result


def to_json_case_location_tree(loc_node):
    location = loc_node.value
    if location == 'ROOT':
        return {
            'location': 'ROOT',
            'children': [to_json_case_location_tree(child) for child in loc_node.children]
        }
    value = loc_node.metadata
    children = [to_json_case_location_tree(child) for child in loc_node.children]
    assert sum(child['value'] for child in children) <= value
    return {
        'value': value,
        'location': location,
        'children': children
    }


def clean_tree(json_case_location_tree):
    """
    Convert an user specified location tree to a well formed one.
    In a well formed location tree, locations with a containment
    relationship are nested and geoname ids are replaced with full geonames.
    Errors will be raised for inconsistent values, duplicate locations,
    and invalid ids.
    """
    tree_nodes = flatten_tree(json_case_location_tree)
    geonames_to_lookup = []
    for item in tree_nodes:
        if isinstance(item['location'], str):
            geonames_to_lookup.append(item['location'])
    geonames_by_id = {}
    if len(geonames_to_lookup) > 0:
        resp = requests.get("https://grits.eha.io/api/geoname_lookup/api/geonames", params={
            "ids": ",".join(geonames_to_lookup)
        })
        resp.raise_for_status()
        for geonameid, doc in zip(geonames_to_lookup, resp.json()['docs']):
            if doc is None:
                raise Exception('Invalid geoname id: ' + geonameid)
            geonames_by_id[geonameid] = doc

    location_value_pairs = []
    for idx, item in enumerate(tree_nodes):
        location = item['location']
        if isinstance(location, str) and location != 'ROOT':
            location = geonames_by_id[location]
        value = item.get('infective', item.get('value', 0))
        location_value_pairs.append((location, value,))

    py_location_tree = LocationTree.from_locations(location_value_pairs)
    result = to_json_case_location_tree(py_location_tree)
    return result


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
    Optional('population'): Or(float, int),
    Optional('featureCode'): str
}, ignore_extra_keys=True)

location_tree_child_schema = Schema({
    'location': Or(str, location_schema),
    Optional('value'): Or(float, int),
    Optional('exposed'): Or(float, int),
    Optional('infective'): Or(float, int),
    Optional('children'): [lambda child: location_tree_child_schema.is_valid(child)]
})

param_schema = Schema({
    'label': str,
    'rank_group': str,
    'active_case_location_tree': {
        'children': [location_tree_child_schema],
    },
    'start_date': str,
    Optional('end_date'): str,
    Optional('sim_group'): str,
    Optional('source_url'): str,
})


class ScoreHandler(tornado.web.RequestHandler):

    @tornado.web.asynchronous
    def post(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        parsed_args = tornado.escape.json_decode(self.request.body)
        try:
            param_schema.validate(parsed_args)
        except SchemaError as e:
            self.write({
                'error': repr(e)
            })
            return self.finish()

        def callback(err, resp):
            result = {
                'finished': datetime.datetime.now(),
            }
            if err:
                result['error'] = repr(err)
            db.rankedUserEventStatus.update_one({
                'rank_group': parsed_args['rank_group'],
            }, {
                '$set': result
            })

        start_date = dateutil.parser.parse(parsed_args['start_date'])
        if 'end_date' in parsed_args:
            end_date = dateutil.parser.parse(parsed_args['end_date'])
        else:
            end_date = start_date + datetime.timedelta(14)
        if db.rankedUserEventStatus.find_one({'rank_group': parsed_args['rank_group']}):
            self.write({
                'error': "Rank group already exists."
            })
            return self.finish()

        cleaned_tree = None
        try:
            logging.info("Processing location tree with %s children..." % len(parsed_args['active_case_location_tree']['children']))
            # logging.info(parsed_args['active_case_location_tree']['children'][0])
            cleaned_tree = clean_tree(parsed_args['active_case_location_tree'])
        except Exception as e:
            self.write({
                'error': repr(e)
            })
            return self.finish()
        logging.info("Queueing task at %s..." % str(datetime.datetime.now()))
        task = tasks.score_airports_for_cases.apply_async(args=[
            cleaned_tree
        ], kwargs=dict(
            start_date_p=start_date,
            end_date_p=end_date,
            sim_group_p=parsed_args.get('sim_group', 'ibis14day'),
            rank_group_p=parsed_args['rank_group']))
        logging.info("Recording status at %s..." % str(datetime.datetime.now()))
        db.rankedUserEventStatus.insert({
            'started': datetime.datetime.now(),
            'rank_group': parsed_args['rank_group'],
            'active_case_location_tree': parsed_args['active_case_location_tree'],
            'source_url': parsed_args.get('source_url'),
            'label': parsed_args['label'],
        })
        self.set_header("Content-Type", "application/json")
        self.write({
            'result': 'started'
        })
        self.finish()
        logging.info("Request finished at %s..." % str(datetime.datetime.now()))
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
            CELERY_ALWAYS_EAGER=True,
        )
    tornado.options.parse_command_line()
    application.listen(80)
    tornado.ioloop.IOLoop.instance().start()
