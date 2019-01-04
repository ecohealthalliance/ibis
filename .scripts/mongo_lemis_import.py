import pymongo
import psycopg2
import pandas as pd
import os


if __name__ == "__main__":
    db = pymongo.MongoClient(os.environ["MONGO_HOST"])["ibis"]
    conn = psycopg2.connect("postgres://postgres:@localhost")
    result = pd.read_sql_query("""
    SELECT
     country_origin_iso2c,
     COUNT (value) AS records,
     SUM (parsed_value) AS total_value,
     SUM (parsed_quantity) AS total_quantity
    FROM
     lemisdb
    WHERE
      Live=1 AND Wild=1 AND NonAq=1
    GROUP BY
     country_origin_iso2c
    ORDER BY
     total_value DESC;
    """,con=conn)
    for item in result.itertuples():
        db.lemis_import.insert({
            'country_origin_iso2c': item.country_origin_iso2c,
            'records': item.records,
            'total_value': item.total_value,
            'total_quantity': item.total_quantity
        })
    db.lemis_import.rename('lemis', dropTarget=True)
