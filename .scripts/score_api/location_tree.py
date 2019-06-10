CONTAINMENT_PROPS = [
    'countryName',
    'admin1Name',
    'admin2Name',
]

def location_contains(locationA, locationB):
    if 'id' not in locationA or 'id' not in locationB:
        return False
    if locationA['id'] == locationB['id']:
        return True
    if locationA['id'] == "6295630": # Earth
        return True
    feature_code = locationA['featureCode'] or ""
    if feature_code.startswith("PCL"):
        containment_level = 1
    elif feature_code.startswith("ADM1"):
        containment_level = 2
    elif feature_code.startswith("ADM2"):
        containment_level = 3
    else:
        return False
    for prop in CONTAINMENT_PROPS[0:containment_level]:
        if prop not in locationB or locationB[prop] == '':
            return False
        if locationA[prop] != locationB[prop]:
            return False
    return True

# A tree of geoname locations where a node is the parent of another
# node if it's location contains the other node's location.
class LocationTree:
    def __init__(self, value, children, metadata=None):
        self.value = value
        self.children = children
        self.metadata = metadata

    # Return the location's node or the node that should be its parent.
    def search(self, location):
        if self.value is "ROOT" or location_contains(self.value, location):
            if 'id' not in location:
                return self
            for subtree in self.children:
                containing_node = subtree.search(location)
                if containing_node:
                    return containing_node
            return self
        else:
            return None

    def contains(self, location):
        return location_contains(self.value, location)

    @staticmethod
    def from_locations(locations_with_metadata): 
        location_tree = LocationTree("ROOT", [])
        for location, metadata in locations_with_metadata:
            node = location_tree.search(location)
            if node.value != 'ROOT' and node.value.get('id', object()) == location.get('id', object()):
                raise Exception("Duplicate location: " + node.value.get('id'))
            if 'id' not in location:
                node.children.append(LocationTree(location, [], metadata))
                continue
            contained = []
            uncontained = []
            for idx, child in enumerate(node.children):
                if location_contains(location, child.value):
                    contained.append(child)
                else:
                    uncontained.append(child)
            node.children = uncontained + [LocationTree(location, contained, metadata)]
        return location_tree
