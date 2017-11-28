# IBIS

Inbound BioEvent Information System

## How to run the app:

IBIS depends on a mongo database populated with flight data by the script here:
https://github.com/ecohealthalliance/flirt-consume

The database's mongo URL should be specified via the FLIGHT_MONGO_URL environment
variable like so:

```
FLIGHT_MONGO_URL=mongodb://localhost:27019 meteor
```