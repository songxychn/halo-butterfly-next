"""Read complete, stable Halo extension inventories without unbounded requests."""


def read_inventory(api, url, page_size=200, max_items=2000):
    items = []
    names = set()
    expected_total = None
    for page in range(1, max_items // page_size + 1):
        response = api(url + '?page=' + str(page) + '&size=' + str(page_size))
        batch = response['items']
        total = response.get('total', len(batch))
        if type(total) is not int or not 0 <= total <= max_items:
            raise RuntimeError('Inventory exceeds fixed total bound: ' + url)
        if expected_total is not None and total != expected_total:
            raise RuntimeError('Inventory changed during pagination: ' + url)
        expected_total = total
        if response.get('page', page) != page or len(batch) > page_size:
            raise RuntimeError('Unexpected inventory page: ' + url)
        for item in batch:
            name = item['metadata']['name']
            if name in names:
                raise RuntimeError('Duplicate inventory identity: ' + url)
            names.add(name)
            items.append(item)
        if not response.get('hasNext', False):
            if len(items) != total:
                raise RuntimeError('Incomplete inventory: ' + url)
            return items
        if not batch:
            raise RuntimeError('Empty non-final inventory page: ' + url)
    raise RuntimeError('Inventory exceeds fixed page bound: ' + url)
