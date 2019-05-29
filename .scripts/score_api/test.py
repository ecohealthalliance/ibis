from server import clean_tree
import unittest

tree = {
    "children": [{
        "location": {
            "longitude": 30.14452,
            "latitude": -6.44596,
            "area": 100000
        },
        "value": 5
    }, {
        "location": "6252001", # USA
        "value": 7
    }, {
        "location": "4155751", # Florida
        "value": 3
    }, {
        "location": "5332921", # California
        "value": 3,
        "children": [
            {
                "location": "5368361", # LA
                "value": 1
            }
        ]
    }, {
        "value": 2,
        'location': {
            'id': '5392171',
            'name': 'San Jose',
            'asciiName': 'San Jose',
            'latitude': 37.33939, 'longitude': -121.89496,
            'featureClass': 'P', 'featureCode': 'PPLA2',
            'countryCode': 'US', 'cc2': '', 'admin1Code': 'CA',
            'admin2Code': '085', 'admin3Code': '', 'admin4Code': '',
            'population': 1026908, 'elevation': '26', 'dem': '23',
            'admin2Name': 'Santa Clara County', 'admin1Name': 'California',
            'countryName': 'United States'}
    }]
}

def print_tree(node, level=0):
    if node['location'] != 'ROOT':
        print(' ' * level + str(node['value']))
        if 'alternateNames' in node['location']:
            del node['location']['alternateNames']
            del node['location']['rawNames']
        print(' ' * level + str(node['location']))
    for child in node.get('children', []):
        print_tree(child, level + 1)

def find_location_node(nodes, location_id):
    for node in nodes:
        if node['location'].get('id') == location_id:
            return node

class Test(unittest.TestCase):
    def test_clean_tree(self):
        cleaned_tree = clean_tree(tree)
        us_node = find_location_node(cleaned_tree['children'], '6252001')
        self.assertTrue(us_node != None)
        self.assertEqual(len(us_node['children']), 2)
        ca_node = find_location_node(us_node['children'], '5332921')
        self.assertTrue(ca_node != None)
        self.assertEqual(len(ca_node['children']), 2)
        la_node = find_location_node(ca_node['children'], '5368361')
        self.assertTrue(la_node != None)
        san_jose_node = find_location_node(ca_node['children'], '5392171')
        self.assertTrue(san_jose_node != None)

    def test_duplicate_location(self):
        duplicate_value = {
            "location": "4155751", # Florida
            "value": 1
        }
        with self.assertRaises(Exception):
            clean_tree({
                "children": tree["children"] + [duplicate_value]
            })

    def test_invalid_value(self):
        bad_value = {
            "location": "5596512", # Idaho
            "value": 7
        }
        with self.assertRaises(Exception):
            clean_tree({
                "children": tree["children"] + [bad_value]
            })

    def test_invalid_id(self):
        bad_location = {
            "location": "fakeid",
            "value": 7
        }
        with self.assertRaises(Exception):
            clean_tree({
                "children": tree["children"] + [bad_location]
            })

if __name__ == '__main__':
    unittest.main()

