### US State Boundaries:

    file: ch_2016_us_state_500k.geo.json
    source: US Census
    url: https://www.census.gov/geo/maps-data/data/cbf/cbf_state.html

The following gdal command was used to convert the shapefile to geojson.

```
ogr2ogr -f "GeoJSON" ch_2016_us_state_500k.geo.json cb_2016_us_state_500k.shp cb_2016_us_state_500k
```

### World-wide Country Boundaries

    file: world.geo.json
    source: Natural Earth
    url: https://geojson-maps.ash.ms/

