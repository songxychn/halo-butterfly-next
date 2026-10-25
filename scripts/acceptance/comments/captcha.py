"""Local arithmetic CAPTCHA UI acceptance; answers are read from the displayed image."""
import copy
import json
from pathlib import Path

PLUGIN = '/api/v1alpha1/configmaps/plugin-comment-widget-configmap'


def run_captcha(client, lab, guard, fixture, output):
    original = client.api(PLUGIN)
    lab.write_json(output / 'captcha-restore.private.json', original, private=True)
    report = {'scope': fixture['scope'], 'provider': 'official arithmetic captcha, anonymous audience', 'restored': False,
              'status': 'running', 'limitations': ['No CAPTCHA bypass or server answer extraction.',
              'Main comment form only; other CAPTCHA providers and audiences are not covered.',
              'Natural expiry is covered only when scope is captcha-expiry; signed-in exemption only in captcha-only.']}
    try:
        config = copy.deepcopy(original)
        security = json.loads(config['data'].get('security', '{}'))
        security['captcha'] = {**security.get('captcha', {}), 'enable': True, 'type': 'ARITHMETIC',
                               'audience': 'ANONYMOUS', 'roles': [], 'arithmeticRange': 10}
        config['data']['security'] = json.dumps(security)
        client.api(PLUGIN, 'PUT', config)
        if client.api(PLUGIN)['data'] != config['data']:
            raise RuntimeError('CAPTCHA configuration did not apply')
        code = guard.run_browser(['bun', str(Path(__file__).with_name('captcha-check.mjs')),
                                 str(output / 'fixture.json')], output / 'captcha.log', lab.BASE['halo'], timeout=600)
        report['exitCode'] = code
        if code: raise RuntimeError('CAPTCHA browser acceptance failed')
        report['status'] = 'passed-tested-scope'
    except guard.BrowserCleanupError as error:
        report['browserCleanupFailed'] = True
        report['status'] = 'failed'; report['error'] = str(error)
        raise
    except Exception as error:
        report['status'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        try:
            if not report.get('browserCleanupFailed'):
                current = client.api(PLUGIN); current['data'] = original['data']
                client.api(PLUGIN, 'PUT', current)
                report['restored'] = client.api(PLUGIN)['data'] == original['data']
                if not report['restored']: raise RuntimeError('CAPTCHA configuration restoration failed')
        except Exception as error:
            report['restoreError'] = str(error); report['status'] = 'failed'
            raise
        finally:
            lab.write_json(output / 'captcha-report.json', report)
