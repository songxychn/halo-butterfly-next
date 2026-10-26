#!/usr/bin/env python3
"""Validate a complete cold/warm/cache-disabled image protocol capture."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def parse_protocol(path):
    phase = None
    requests = {}
    responses = []
    boundaries = []
    decoder = json.JSONDecoder()

    def event(value, scope=''):
        scope = value.get('sessionId', scope)
        params = value.get('params', {})
        method = value.get('method', '')
        if isinstance(params.get('message'), str):
            event(json.loads(params['message']), str(params.get('targetId', scope)))
        if phase is None:
            return
        key = (phase['engine'], scope, params.get('requestId'))
        if method == 'Network.requestWillBeSent':
            url = params.get('url') or params.get('request', {}).get('url')
            requests[key] = {'url': url, 'round': phase['round']}
        elif method in ['Network.responseReceived', 'Network.requestServedFromMemoryCache']:
            request = requests.get(key, {})
            response = params.get('response', {})
            resource = params.get('resource', {})
            url = response.get('url') or resource.get('url') or request.get('url', '')
            source = ('cache' if params['fromCache'] else 'network') if 'fromCache' in params else ('memory-cache' if method.endswith('MemoryCache') else response.get('source', 'unknown'))
            responses.append({'engine': phase['engine'], 'round': request.get('round', phase['round']), 'url': url,
                              'source': source, 'status': params.get('status', response.get('status', resource.get('response', {}).get('status'))),
                              'requestId': params.get('requestId'), 'method': method})
    for number, line in enumerate(path.open(), 1):
        line = re.sub(r'\x1b\[[0-9;]*m', '', line)
        if line.startswith('CACHE_BOUNDARY '):
            phase = json.loads(line.split('CACHE_BOUNDARY ', 1)[1])
            boundaries.append({**phase, 'line': number})
        elif 'pw:protocol' in line and 'RECV' in line:
            assert '{' in line, 'Malformed protocol line'
            event(decoder.raw_decode(line[line.index('{'):])[0])
    return boundaries, responses


def validate(browser, boundaries, responses):
    expected = [(engine, phase) for engine in ['firefox', 'webkit'] for phase in ['setup', 'cold', 'warm', 'cache-disabled', 'closed']]
    assert [(x['engine'], x['round']) for x in boundaries] == expected, 'Missing/overlapping protocol boundaries'
    assert all(x['runId'] == browser['runId'] for x in boundaries)
    assert browser['result'] == 'protocol-verification-required' and browser['restoration']['result'] == 'passed'
    assert [(x['engine'], x['round']) for x in browser['checks']] == [(e, p) for e in ['firefox', 'webkit'] for p in ['cold', 'warm', 'cache-disabled']]
    conclusions = []
    for engine in ['firefox', 'webkit']:
        cases = {x['round']: x for x in browser['checks'] if x['engine'] == engine}
        snapshots = {k: {i['id']: i for i in x['images']} for k, x in cases.items()}
        assert all(set(x) == {'native-eager', 'native-plain', 'native-lazy', 'native-responsive'} for x in snapshots.values())
        for image_id, cold in snapshots['cold'].items():
            url = cold['url']
            assert browser['runId'] in url
            for phase in ['warm', 'cache-disabled']:
                current = snapshots[phase][image_id]
                assert current['url'] == url and current['width'] == cold['width'] > 0
                assert not current['pending'] and current['filter'] == 'none'
            observed = {phase: [r for r in responses if r['engine'] == engine and r['round'] == phase and r['url'] == url] for phase in cases}
            for phase in ['cold', 'cache-disabled']:
                assert observed[phase] and all(r['status'] == 200 and r['source'] == 'network' for r in observed[phase]), 'Cold/cache-disabled network control missing: ' + engine + '/' + image_id
            warm = observed['warm']
            if warm:
                assert all(r['status'] == 200 and r['source'] in ['cache', 'memory-cache', 'disk-cache'] for r in warm), 'Warm image not from cache'
                verdict = 'explicit-protocol-cache'
            else:
                # Firefox's decoded-image cache can avoid creating a network
                # channel altogether. This is an inference supported by the
                # same-URL cold and cache-disabled network controls, not an
                # invented fromCache flag or proof of persistent disk storage.
                assert engine == 'firefox'
                assert any(r['engine'] == engine and r['round'] == 'warm' and r['status'] == 200 for r in responses), 'Warm capture has no network evidence'
                verdict = 'decoded-image-reuse-inferred-from-controls'
            conclusions.append({'engine': engine, 'image': image_id, 'url': url, 'verdict': verdict, 'protocol': observed})
    return conclusions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('browser_report', type=Path)
    parser.add_argument('protocol_log', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.output.resolve().is_relative_to(Path(__file__).resolve().parents[2] / '.runtime')
    assert not args.output.exists(), 'Never overwrite a verdict'
    browser = json.loads(args.browser_report.read_text())
    boundaries, responses = parse_protocol(args.protocol_log)
    result = {'schema': 1, 'runId': browser['runId'], 'result': 'failed',
              'browserReportSha256': hashlib.sha256(args.browser_report.read_bytes()).hexdigest(),
              'protocolSha256': hashlib.sha256(args.protocol_log.read_bytes()).hexdigest(), 'boundaries': boundaries}
    try:
        result['images'] = validate(browser, boundaries, responses)
        result['result'] = 'passed-tested-scope'
    except Exception as error:
        result['error'] = str(error)
        raise
    finally:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'result': result['result'], 'output': str(args.output)}))


if __name__ == '__main__':
    main()
