# IBIS

Inbound BioEvent Information System

## How to run the app:

IBIS depends on a mongo database populated with flight data by the script here:
https://github.com/ecohealthalliance/flirt-consume

The database's mongo URL should be specified via the FLIGHT_MONGO_URL environment
variable like so:

```
FLIGHT_MONGO_URL=mongodb://localhost:27019/flirt meteor
```

IBIS also requires bioevent rank data to be pre-computed by executing the jupyter notebook
in .scripts. This will generate an html document in /public showing information
that can be used check the conputations:

```
pip install jupyter pymongo
MONGO_HOST=localhost:27017 jupyter nbconvert --execute --ExecutePreprocessor.kernel_name=python --ExecutePreprocessor.timeout=None --allow-errors .scripts/rank_events.ipynb --output ../public/rank_event.html 
```
