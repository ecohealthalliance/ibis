"""
Script for identifying diseases mentioned in NBIC reports.
"""
import os
import re
import glob
import dateparser
import pymongo
from utils import clean, lookup_disease


DISEASE_STATUS_RE = re.compile(
    r"(?<!\S)\n(\S[^\-\n]{3,60}) *\-\s*([^\-\n]{1,30}[\s\S][^\-\n]{1,30}[\s\S][^\-\n]{1,30})\n{,3}"
    r".*Current Event Status ?(\(.+\).*|\:.+)\n", re.MULTILINE)
BRACKETED_EXPRESSION_RE = re.compile(
    r"(\[[^\[\]]{,100}\]|<[^<>]{,100}>) ?", re.MULTILINE)
db = pymongo.MongoClient(os.environ["MONGO_HOST"])["nbic"]
db.nbic.drop()
file_paths = glob.glob('NBIC Monitoring Lists - EML/*.eml')
for file_path in file_paths:
    disease_to_metadata = {}
    with open(file_path, 'r') as f:
        plain_text = None
        date = None
        try:
            message_text = f.read()
            message_text = message_text.replace('=\n', '').replace('=E2=80=93', '-')
            message_text = BRACKETED_EXPRESSION_RE.sub("", message_text)
            forwarded_message = re.split("\n\-{5,} Forwarded message \-{5,}\n", message_text)[1]
            [plain_text, html_content] = forwarded_message.split("Content-Transfer-Encoding: quoted-printable")
            message_date_match = re.search(r"Date: (.*)\n", forwarded_message)
            date = dateparser.parse(message_date_match.groups()[0])
        except Exception as e:
            print(file_path)
            print("Parse error: " + str(e))
            continue
        for section in re.split("\n\-{5,}\n", plain_text):
            section = "\n" + section
            for disease_name_match in DISEASE_STATUS_RE.finditer(section):
                if disease_name_match:
                    #print(re.match(r"\s*High Priority Event Updates", section))
                    [disease_name, location, status] = disease_name_match.groups()
                    disease_name = re.sub(r"\*", "", disease_name).strip()
                    for possible_status in "Worsening|No Change|Improving|Undetermined".split('|'):
                        if possible_status.lower() in status.lower():
                            status = possible_status
                            break
                    disease_to_metadata[disease_name] = {
                        'location': clean(location),
                        'status': status
                    }
        db.nbic.insert({
            'file': file_path,
            'date': date,
            'diseases': [{
                'nameUsed': disease,
                'metadata': metadata,
                'resolved': lookup_disease(disease)
            } for disease, metadata in disease_to_metadata.items()],
        })

print('Diseases by article:')
for item in db.nbic.find():
    print(item['file'])
    print([d['nameUsed'] for d in item['diseases']])

print('Mentions by disease:')
for item in db.nbic.aggregate([
    { '$unwind': '$diseases' },
    {
        '$group': {
            '_id': {
                '$ifNull': ['$diseases.resolved.id', '$diseases.nameUsed'],
            },
            'mentions': {
                '$sum': 1
            },
            'metadata': {
                '$first': '$diseases.metadata'
            }
        }
    }
]):
    print(item)
