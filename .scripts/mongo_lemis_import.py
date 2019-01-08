import pymongo
import psycopg2
import pandas as pd
import os


if __name__ == "__main__":
    db = pymongo.MongoClient(os.environ["MONGO_HOST"])["ibis"]
    conn = psycopg2.connect(os.environ.get("POSTGRES_HOST", "postgres://postgres:@localhost"))
    result = pd.read_sql_query("""
    SELECT
     country_origin_iso2c AS country,
     min(binomial) AS species,
     COUNT (value) AS records,
     COALESCE(SUM (parsed_value), 0) AS value,
     COALESCE(SUM (parsed_quantity), 0) AS quantity
    FROM
     lemisdb
    WHERE
      Live=1 AND Wild=1 AND NonAq=1
    GROUP BY
     country_origin_iso2c, species_code;
    """, con=conn)
    for idx, item in result.iterrows():
        db.lemis_import.insert(item.to_dict())
    db.lemis_import.rename('lemis', dropTarget=True)
