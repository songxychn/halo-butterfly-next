"""Bounded comment visibility/permission settings; called inside run.py's ownership window."""
import copy
import json
from pathlib import Path

SYSTEM = '/api/v1alpha1/configmaps/system'
PLUGIN = '/api/v1alpha1/configmaps/plugin-comment-widget-configmap'


def run_policies(client, lab, guard, fixture, output, subject_url):
    originals = {url: client.api(url) for url in [SYSTEM, PLUGIN, subject_url]}
    lab.write_json(output / 'policies-restore.private.json', originals, private=True)
    base_comment = json.loads(originals[SYSTEM]['data']['comment'])
    report = {'scope': 'comment-policy-surface', 'cases': [], 'status': 'running',
              'limitations': ['No captcha solution, uploaded attachment or moderation submission is counted by surface checks.'],
              'restored': False}
    scenarios = [
        ('enabled', {}, {}, True),
        ('global-disabled', {'enable': False}, {}, False),
        ('members-only', {'systemUserOnly': True}, {}, True),
        ('moderation-enabled', {'requireReviewForNew': True}, {}, True),
        ('private-enabled', {}, {'basic': {'enablePrivateComment': True}}, True),
        ('captcha-anonymous', {}, {'security': {'captcha': {'enable': True, 'type': 'ARITHMETIC', 'audience': 'ANONYMOUS', 'roles': []}}}, True),
        ('upload-disabled', {}, {'editor': {'enableUpload': False, 'enableEmoji': False}}, True),
    ]
    if fixture['post']['kind'] != 'Moment':
        scenarios.append(('subject-disabled', {}, {}, False))
    def restore_object(url, original):
        value = client.api(url)
        if 'data' in original: value['data'] = original['data']
        else: value['spec'] = original['spec']
        client.api(url, 'PUT', value)
        actual = client.api(url)
        field = 'data' if 'data' in original else 'spec'
        if actual[field] != original[field]: raise RuntimeError('Policy restoration mismatch: ' + url)
    try:
        for name, comment, plugin, visible in scenarios:
            system = client.api(SYSTEM)
            system['data']['comment'] = json.dumps({**base_comment, **comment})
            client.api(SYSTEM, 'PUT', system)
            config = client.api(PLUGIN)
            config['data'] = copy.deepcopy(originals[PLUGIN]['data'])
            for group, changes in plugin.items():
                config['data'][group] = json.dumps({**json.loads(config['data'].get(group, '{}')), **changes})
            client.api(PLUGIN, 'PUT', config)
            if name == 'subject-disabled':
                subject = client.api(subject_url)
                subject['spec']['allowComment'] = False
                client.api(subject_url, 'PUT', subject)
            case = {**fixture, 'policy': name, 'visible': visible}
            lab.write_json(output / 'policy-fixture.json', case)
            code = guard.run_browser(['bun', str(Path(__file__).with_name('policy-check.mjs')), str(output / 'policy-fixture.json')], output / (name + '.log'), lab.BASE['halo'], timeout=300)
            report['cases'].append({'policy': name, 'exitCode': code})
            lab.write_json(output / 'policies-report.json', report)
            if code: raise RuntimeError('Comment policy browser failure: ' + name)
        report['status'] = 'passed-tested-scope'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        raise
    finally:
        errors = []
        for url in [subject_url, PLUGIN, SYSTEM]:
            try: restore_object(url, originals[url])
            except Exception as error: errors.append(str(error))
        report['restored'] = not errors
        report['restoreErrors'] = errors
        if errors: report['status'] = 'failed'
        lab.write_json(output / 'policies-report.json', report)
        if errors: raise RuntimeError('Policy restore failed: ' + '; '.join(errors))
