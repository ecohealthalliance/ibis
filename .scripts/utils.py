import re
import requests
import os
import functools
import json
try:
    from functools import lru_cache
except ImportError:
    from backports.functools_lru_cache import lru_cache


GRITS_URL = os.environ.get("GRITS_URL", "https://grits.eha.io")


def clean(s):
    s = re.sub(r"\(.*\)", "", s)
    s = re.sub(r"\[.*\]", "", s)
    s = s.replace("*", "")
    return re.sub(r"\s+", " ", s).strip()


def clean_disease_name(s):
    s = re.sub(r"^(Highly Pathogenic|Virulent|Suspected)", "", s, re.I)
    s = re.sub(" Serotype .+$", "", s, re.I)
    return clean(s)


@lru_cache()
def lookup_geoname(name):
    resp = requests.get(GRITS_URL + "/api/geoname_lookup/api/lookup", params={
        "q": clean(name)
    })
    result = json.loads(resp.text)["hits"][0]["_source"]
    del result["alternateNames"]
    del result["rawNames"]
    del result["asciiName"]
    del result["cc2"]
    del result["elevation"]
    del result["dem"]
    del result["timezone"]
    del result["modificationDate"]
    return result


@lru_cache()
def lookup_disease(name):
    if len(name) == 0:
        return None
    cleaned_name = clean_disease_name(name)
    if cleaned_name.startswith("foot and mouth disease"):
        # Prevent matches with "hand, foot and mouth disease"
        return None
    resp = requests.get(GRITS_URL + "/api/v1/disease_ontology/lookup", params={
        "q": cleaned_name
    })
    result = resp.json()
    first_result = next(iter(result["result"]), None)
    if first_result:
        return {
            "id": first_result["id"],
            "text": first_result["label"]
        }
    elif "avian influenza" in name.lower():
        return {
            "id": "http://purl.obolibrary.org/obo/DOID_4492",
            "text": "Avian Influenza"
        }
