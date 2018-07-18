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

IBIS also requires bioevent rank data to be pre-computed by executing .scripts/rank_events.py

```
pip install -r .scripts/requirements.pip
MONGO_HOST=localhost:27017 python .scripts/rank_events.py
```
