"""Native content visibility checks within the coordinator's owned fixture window."""
import copy
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request


def run_access(client, lab, fixture, output, subject_url):
    original = client.api(subject_url)
    assert fixture['post']['kind'] in ['Post', 'SinglePage']
    assert original['spec']['owner'] == client.auth['username']
    title = original['spec']['title']
    plural = 'posts' if fixture['post']['kind'] == 'Post' else 'singlepages'
    public_api = '/apis/api.content.halo.run/v1alpha1/' + plural
    report = {'scope': 'native-visibility-http', 'cases': [], 'status': 'running', 'restored': False,
              'limitations': ['HTTP markup and public API only; no browser TOC interaction or non-owner signed-in session in this batch.',
                              'INTERNAL is not treated as a promise that every signed-in user can read it.']}
    lab.write_json(output / 'access-restore.private.json', original, private=True)

    def fetch(opener, path):
        request = urllib.request.Request(lab.BASE['halo'] + path, headers={'Accept': 'application/json' if path.startswith('/apis/') else 'text/html'})
        try:
            response = opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            assert urllib.parse.urlsplit(response.url).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc
            body = response.read().decode()
            row = {'path': path, 'status': response.status, 'bytes': len(body.encode()), 'sha256': hashlib.sha256(body.encode()).hexdigest(), 'titlePresent': title in body}
            return row, body

    def set_visible(visible):
        value = client.api(subject_url)
        value['spec']['visible'] = visible
        client.api(subject_url, 'PUT', value)
        # Wait only for the core controller's declared visibility label; never
        # retry a failed content request to manufacture a passing measurement.
        deadline = time.monotonic() + 20
        while True:
            value = client.api(subject_url)
            if value['metadata'].get('labels', {}).get('content.halo.run/visible') == visible:
                assert value['spec']['visible'] == visible
                return
            assert time.monotonic() < deadline, 'Visibility controller readiness timed out'
            time.sleep(.1)

    try:
        for visible in ['PUBLIC', 'INTERNAL', 'PRIVATE', 'PUBLIC']:
            set_visible(visible)
            case = {'visibility': visible, 'requests': [], 'result': 'running'}
            report['cases'].append(case)
            for identity, opener in [('anonymous', lab.LOCAL), ('owner', client.opener)]:
                for path in [fixture['post']['path'], public_api + '/' + fixture['post']['name']]:
                    row, body = fetch(opener, path)
                    row['identity'] = identity
                    case['requests'].append(row)
                    readable = visible == 'PUBLIC' or identity == 'owner'
                    if readable:
                        assert row['status'] == 200 and row['titlePresent'], row
                        assert 'Owned local comment acceptance fixture.' in body, 'Authorized body missing'
                    else:
                        assert row['status'] in [401, 403, 404] and not row['titlePresent'], row
                        assert 'Owned local comment acceptance fixture.' not in body, 'Unauthorized body leaked'
            row, body = fetch(lab.LOCAL, public_api + '?size=100')
            row['identity'] = 'anonymous-list'
            case['requests'].append(row)
            assert row['status'] == 200
            data = json.loads(body)
            assert data['total'] <= 100, 'Bounded listing incomplete'
            found = any(item['metadata']['name'] == fixture['post']['name'] for item in data['items'])
            assert found == (visible == 'PUBLIC'), 'Anonymous listing visibility mismatch'
            if visible != 'PUBLIC':
                assert not row['titlePresent'], 'Private title/excerpt leaked in public API list'
                for path in ['/', '/archives/']:
                    row, body = fetch(lab.LOCAL, path)
                    row['identity'] = 'anonymous-list'
                    case['requests'].append(row)
                    assert row['status'] == 200 and not row['titlePresent'], 'Private title/excerpt leaked in theme listing'
            case['result'] = 'passed'
            lab.write_json(output / 'access-report.json', report)
        report['status'] = 'passed-tested-scope'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        raise
    finally:
        current = client.api(subject_url)
        current['spec'] = copy.deepcopy(original['spec'])
        client.api(subject_url, 'PUT', current)
        set_visible(original['spec']['visible'])
        report['restored'] = client.api(subject_url)['spec'] == original['spec']
        lab.write_json(output / 'access-report.json', report)
        assert report['restored'], 'Native visibility fixture restoration failed'
