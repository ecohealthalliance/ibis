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
            message_text_array = list(message_text)
            for i in reversed(list(re.finditer(r'(=[0-9A-F]{2}){1,3}', message_text))):
                message_text_array[i.start():i.end()] = bytes.fromhex(
                    message_text[i.start():i.end()].replace('=', '')).decode('utf-8', errors='ignore')
            message_text = ''.join(message_text_array)
            message_text = BRACKETED_EXPRESSION_RE.sub("", message_text)
            forwarded_message = re.split(r"\n(?:\-{5,} Forwarded message \-{5,}|Begin forwarded message:)\n", message_text)[1]
            [plain_text, html_content] = forwarded_message.split("Content-Transfer-Encoding: quoted-printable")[:2]
            message_date_match = re.search(r"Date: (.*)\n", forwarded_message)
            date = dateparser.parse(message_date_match.groups()[0])
        except Exception as e:
            print(file_path)
            print(forwarded_message)
            print("Parse error: " + str(e))
            raise
            #continue
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

total_disease_topics = 0
total_resolved_disease_topics = 0

print('Diseases by article:')
for item in db.nbic.find():
    print(item['file'])
    print([d['nameUsed'] for d in item['diseases']])
    total_disease_topics += len(item['diseases'])
    total_resolved_disease_topics += len([d for d in item['diseases'] if d['resolved']])

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

print("Total Articles:")
print(db.nbic.count())
print("Total Disease Topics:")
print(total_disease_topics)
print("Total Resolved Disease Topics:")
print(total_resolved_disease_topics)
