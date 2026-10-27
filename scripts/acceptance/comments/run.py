#!/usr/bin/env python3
"""Fixed real official-comment UI acceptance against an already-running owned lab."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import urllib.parse
import zipfile
from inventory import read_inventory
from subscriptions import rotating_subscription

REPO = Path(__file__).resolve().parents[3]
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
CONTENT = '/apis/content.halo.run/v1alpha1/'
NOTIFICATION = '/apis/notification.halo.run/v1alpha1/'
PLUGINS = '/apis/plugin.halo.run/v1alpha1/plugins'
CONFIG = CONSOLE + 'themes/halo-butterfly-next/json-config'
SYSTEM = '/api/v1alpha1/configmaps/system'
SENDER = CONSOLE + 'notifiers/default-email-notifier/sender-config'
OWNER = 'comment-usage-followup-owner'
COMMENT_JAR = 'e569a4bd8aade89383c8c7fee169fd822cfa80ff01341fdaa292cd2cd9db8f3f'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--subject', choices=['Post','SinglePage','Moment'], default='Post')
    parser.add_argument('--cases', choices=['full-six', 'corrected-five', 'reply-three', 'webkit-two', 'firefox-signed', 'lifecycle-only', 'policy-only', 'access-only', 'language-only', 'captcha-only', 'captcha-expiry', 'upload-natural', 'upload-only', 'upload-direct', 'upload-webkit-direct', 'upload-isolated'], default='full-six')
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    parser.add_argument('--lifecycle-pairs', type=int, choices=[1, 6], default=1)
    args = parser.parse_args()
    require(args.cases != 'upload-natural' or args.subject == 'Post', 'Natural-time lifecycle scope is the fixed Post API fixture')
    require(args.lifecycle_pairs == 1 or args.cases == 'lifecycle-only', 'Pair count only applies to lifecycle-only')
    require(args.cases not in ['access-only', 'language-only'] or args.subject != 'Moment', 'Native content access/language applies to Post and SinglePage')
    subject_collection = {'Post':'posts','SinglePage':'singlepages','Moment':'moments'}[args.subject]
    subject_group = 'moment.halo.run' if args.subject == 'Moment' else 'content.halo.run'
    def collection_api(plural):
        return ('/apis/moment.halo.run/v1alpha1/' if plural == 'moments' else CONTENT) + plural
    runtime = args.runtime.resolve(strict=True)
    require(runtime.is_relative_to(REPO / '.runtime') and not args.runtime.is_symlink(), 'Not an owned runtime')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1, 'Ownership marker mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('comment_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    guard_spec = importlib.util.spec_from_file_location('fault_guard', REPO / 'scripts/perf/fault-followup.py')
    guard = importlib.util.module_from_spec(guard_spec); guard_spec.loader.exec_module(guard)
    cases = [{'engine': engine, 'signedIn': signed} for engine in ['chromium', 'firefox', 'webkit'] for signed in [False, True] if not (args.cases in ['corrected-five', 'reply-three'] and engine == 'firefox' and not signed) and not (args.cases == 'reply-three' and engine == 'webkit') and not (args.cases == 'webkit-two' and engine != 'webkit') and not (args.cases == 'firefox-signed' and (engine != 'firefox' or not signed)) and args.cases != 'lifecycle-only']
    if args.cases in ['upload-isolated', 'upload-webkit-direct']:
        cases = [{'engine':'webkit','signedIn':False}, {'engine':'webkit','signedIn':True}]
    if args.cases == 'upload-natural':
        cases = []  # Four API lifecycle conditions, not a declared browser matrix.
    if args.cases == 'captcha-expiry':
        cases = [{'engine': 'chromium', 'signedIn': False}]
    run = secrets.token_hex(10)
    output = runtime / 'comment-usage-followup' / run
    require(not list(runtime.glob('*.lock')), 'Another runtime lock is present')
    lock = runtime / 'acceptance-comments.lock'
    with lock.open('x') as stream:
        stream.write(run)
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    report = {'schema': 1, 'runId': run, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'running', 'errors': [], 'created': [], 'cleanup': [], 'batches': [], 'pluginTransitions': []}
    client = before = original_config = original_comment = None
    changed = False
    plugin_original = None
    upload_batch = None
    post_name = 'comment-usage-' + run
    title = 'Comment usage ' + run
    def save():
        lab.write_json(output / 'report.json', report)
    def optional(url):
        try:
            return client.api(url)
        except lab.ApiError as error:
            if error.status != 404:
                raise
    def inventory(url):
        return read_inventory(client.api, url)
    def identity():
        require(lab.owned_process('halo'), 'Owned Halo process not live')
        state = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo' / lab.HALO_JAR_NAME
        command = subprocess.check_output(['ps', '-p', str(state['pid']), '-o', 'command='], text=True)
        require(state['identity'] == str(jar) and str(jar) in command and str(runtime / 'halo/data') in command, 'Wrong JVM identity')
        require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
        require(lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo JAR mismatch')
        package = args.package.resolve(strict=True)
        require(package.is_relative_to(REPO), 'Package outside repo')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == lab.digest(package), 'Installed package attribution mismatch')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', 'src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(package) as archive:
            files = [n for n in archive.namelist() if not n.endswith('/')]
            require(len(files) == len(set(files)) == 269, 'Expected 269 unique files')
            root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
            for name in files:
                target = (root / name).resolve()
                require(target.is_relative_to(root) and target.read_bytes() == archive.read(name), 'Theme bytes differ: ' + name)
        jars = {p.name: lab.digest(p) for p in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        require(COMMENT_JAR in jars.values(), 'Official CommentWidget 3.3.2 JAR missing')
        return {'installed': installed, 'haloSha256': lab.digest(jar), 'packageFiles': len(files), 'pluginJars': jars}
    def notifier_identity():
        descriptors = inventory(NOTIFICATION + 'notifierDescriptors')
        require(len(descriptors) == 1 and descriptors[0]['metadata']['name'] == 'default-email-notifier' and descriptors[0]['spec']['notifierExtName'] == 'halo-email-notifier', 'Additional/unknown notifier: this fixed batch cannot prove it disabled')
        sender = client.api(SENDER)
        require(not sender.get('enable') and not sender.get('host'), 'SMTP must already be unconfigured and disabled')
        return {'descriptorsSha256': digest(descriptors), 'senderConfigSha256': digest(sender), 'onlyDefaultEmailNotifier': True, 'smtpEnabled': False, 'smtpHostPresent': False}
    def rotating_post_subscription(obj):
        return rotating_subscription(obj, args.subject, report.get('preserveExistingReplySubscription', False))
    def settle_notifications(label):
        # Official login and subscription reconciliation is setup/cleanup
        # readiness only, not a browser measurement retry or a new timeout.
        observations = []
        report.setdefault('notificationReadiness', []).append({'label': label, 'limitSeconds': 30, 'observations': observations})
        deadline = time.monotonic() + 30
        stable_since = None
        previous = None
        while True:
            reasons = inventory(NOTIFICATION + 'reasons')
            subscriptions = inventory(NOTIFICATION + 'subscriptions')
            login = [o['metadata']['name'] for o in reasons if o['spec'].get('reasonType') == 'new-device-login' and o['spec'].get('author') == 'fixture-maintainer']
            deleting = [o['metadata']['name'] for o in subscriptions if o['metadata'].get('deletionTimestamp')]
            observations.append({'at': time.time(), 'loginReasons': login, 'deletingSubscriptions': deleting})
            save()
            require(time.monotonic() < deadline, 'Notification readiness exceeded fixed 30s: ' + label)
            signature = digest([(o['metadata']['name'], o['spec']) for o in sorted(subscriptions, key=lambda o: o['metadata']['name'])])
            # Reply subscriptions rotate asynchronously after successful writes.
            # One empty deleting-list is only a momentary observation. Require
            # the inventory to remain stable within the existing 30s setup gate.
            if not login and not deleting and signature == previous:
                if stable_since is not None and time.monotonic() - stable_since >= 2:
                    return
            else:
                stable_since = time.monotonic() if not login and not deleting else None
            previous = signature
            time.sleep(.25)
    def notification_inventory():
        result = {}
        owned = {(r['collection'], r['name']) for r in report['created']}
        snapshot = {}
        for plural in ['reasons', 'notifications', 'subscriptions']:
            objects = inventory(NOTIFICATION + plural)
            snapshot[plural] = objects
            result[plural] = []
            for obj in objects:
                name = obj['metadata']['name']
                if (plural, name) in owned:
                    continue
                if plural == 'subscriptions' and rotating_post_subscription(obj):
                    require(not obj['metadata'].get('deletionTimestamp'), 'Post subscription has not converged')
                    stable = {k: v for k, v in obj['spec'].items() if k != 'unsubscribeToken'}
                    result[plural].append({'name': 'semantic:fixture-maintainer:' + obj['spec']['reason']['reasonType'], 'specSha256': digest(stable)})
                    report.setdefault('postSubscriptionRotations', []).append({'name': name, 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'fullSpecSha256': digest(obj['spec']), 'unsubscribeTokenSha256': digest(obj['spec']['unsubscribeToken']), 'semanticSha256': digest(stable)})
                else:
                    result[plural].append({'name': name, 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': digest(obj['spec'])})
            result[plural].sort(key=lambda x: x['name'])
            semantic = [x['name'] for x in result[plural] if x['name'].startswith('semantic:')]
            require(len(semantic) == len(set(semantic)), 'Duplicate semantic subscriptions')
        snapshots = report.setdefault('privateNotificationSnapshots', [])
        filename = 'notifications-' + str(len(snapshots)) + '.private.json'
        lab.write_json(output / filename, snapshot, private=True)
        snapshots.append({'path': filename, 'sha256': lab.digest(output / filename)})
        return result
    def station():
        plugins = []
        for obj in sorted(inventory(PLUGINS), key=lambda x: x['metadata']['name']):
            config = optional('/api/v1alpha1/configmaps/' + urllib.parse.quote(obj['spec']['configMapName'], safe='')) if obj['spec'].get('configMapName') else None
            plugins.append({'name': obj['metadata']['name'], 'version': obj['spec']['version'], 'enabled': obj['spec'].get('enabled'), 'phase': obj.get('status', {}).get('phase'), 'specSha256': digest(obj['spec']), 'configSha256': digest(config.get('data', {})) if config else None})
        contents = {}
        for plural in ['posts', 'singlepages', 'comments', 'replies'] + (['moments'] if args.subject == 'Moment' else []):
            rows = []
            for obj in inventory(collection_api(plural)):
                if is_owned_content(plural, obj):
                    continue
                row = {'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': digest(obj['spec'])}
                if plural in ['posts', 'singlepages'] and obj['spec'].get('publish'):
                    row['releaseSha256'] = digest(client.api(CONSOLE + plural + '/' + obj['metadata']['name'] + '/release-content'))
                rows.append(row)
            contents[plural] = sorted(rows, key=lambda x: x['name'])
        active = client.api(CONSOLE + 'themes/-/activation')
        require(active['metadata']['name'] == 'halo-butterfly-next', 'Unexpected active theme')
        return {'activeTheme': {'name': active['metadata']['name'], 'version': active['spec']['version']}, 'themeConfigSha256': digest(client.api(CONFIG)), 'systemDataSha256': digest(client.api(SYSTEM).get('data', {})), 'notifiers': notifier_identity(), 'notifications': notification_inventory(), 'plugins': plugins, 'contents': contents}
    def is_owned_content(plural, obj):
        if plural == subject_collection:
            return obj['metadata']['name'] == post_name and obj['metadata'].get('labels', {}).get(OWNER) == run
        if plural == 'comments':
            return obj['spec'].get('subjectRef') == {'group': subject_group, 'version': 'v1alpha1', 'kind': args.subject, 'name': post_name} and run in obj['spec'].get('raw', '')
        if plural == 'replies':
            return obj['spec'].get('commentName') in {x['name'] for x in report['created'] if x['collection'] == 'comments'} and run in obj['spec'].get('raw', '')
        return False
    def register(collection, obj):
        require(bool(obj['metadata'].get('creationTimestamp')), 'Missing creation timestamp')
        row = {'collection': collection, 'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata']['creationTimestamp'], 'specSha256': digest(obj['spec'])}
        existing = next((r for r in report['created'] if r['collection'] == collection and r['name'] == row['name']), None)
        if existing:
            require(existing == row, 'Registered object unexpectedly changed')
        else:
            report['created'].append(row)
        save()
    def poll(label, read, predicate, limit=30):
        row = {'label': label, 'limitSeconds': limit, 'observations': []}
        report.setdefault('polls', []).append(row)
        deadline = time.monotonic() + limit
        while True:
            obj = read()
            row['observations'].append({'at': time.time(), 'sha256': digest(obj)})
            save()
            require(time.monotonic() < deadline, label + ' timed out')
            if predicate(obj):
                return obj
            time.sleep(.25)
    def plugin_state(enable):
        current = client.api(PLUGINS + '/PluginCommentWidget')
        require(plugin_original is not None and current['metadata'].get('creationTimestamp') == plugin_original['metadata'].get('creationTimestamp'), 'Comment plugin instance replaced')
        require({k: v for k, v in current['spec'].items() if k != 'enabled'} == {k: v for k, v in plugin_original['spec'].items() if k != 'enabled'}, 'Comment plugin spec/version changed')
        if current['spec']['enabled'] != enable:
            client.api(CONSOLE + 'plugins/PluginCommentWidget/plugin-state', 'PUT', {'enable': enable, 'async': False})
        obj = poll('plugin ' + str(enable), lambda: client.api(PLUGINS + '/PluginCommentWidget'), lambda x: x['spec']['enabled'] is enable and x.get('status', {}).get('phase') == ('STARTED' if enable else 'DISABLED'))
        report['pluginTransitions'].append({'enabled': enable, 'phase': obj['status']['phase']})
        save()
    def browser(phase):
        row = {'phase': phase, 'timeoutSeconds': 1200 if phase == 'usage' else 300}
        report['batches'].append(row); save()
        row['exitCode'] = guard.run_browser(['bun', str(Path(__file__).with_name('check.mjs')), str(output / 'fixture.json'), phase], output / (phase + '.log'), lab.BASE['halo'], timeout=row['timeoutSeconds'])
        save()
        require(row['exitCode'] == 0, 'Browser phase failed: ' + phase)
    def collect_children():
        # A lost POST response can still be recovered only through the random
        # owned subject and exact run-token text; no generic deletion by date.
        for plural in ['comments', 'replies']:
            for obj in inventory(collection_api(plural)):
                if is_owned_content(plural, obj):
                    require(run in obj['spec'].get('raw', '') and obj['spec'].get('allowNotification') is True, 'Unexpected official comment payload')
                    owner = obj['spec'].get('owner', {})
                    require(owner.get('name') in [client.auth['username']] or run in owner.get('name', ''), 'Unexpected synthetic owner')
                    register(plural, obj)
    def collect_notifications():
        names = {r['name'] for r in report['created'] if r['collection'] in ['comments', 'replies']}
        reason_names = set()
        for obj in inventory(NOTIFICATION + 'reasons'):
            raw = json.dumps(obj.get('spec', {}), ensure_ascii=False)
            if run in raw or any(n in raw for n in names):
                register('reasons', obj)
                reason_names.add(obj['metadata']['name'])
        for obj in inventory(NOTIFICATION + 'notifications'):
            raw = json.dumps(obj.get('spec', {}), ensure_ascii=False)
            if run in raw or obj['spec'].get('reason') in reason_names:
                register('notifications', obj)
        original = set(report.get('originalSubscriptionNames', []))
        for obj in inventory(NOTIFICATION + 'subscriptions'):
            s = obj['spec'];reason = s.get('reason', {})
            if obj['metadata']['name'] not in original and reason.get('reasonType') == 'someone-replied-to-you' and not rotating_post_subscription(obj):
                expression = reason.get('expression', '')
                if run in expression or expression == "props.repliedOwner == 'fixture-maintainer'":
                    created = datetime.datetime.fromisoformat(obj['metadata']['creationTimestamp'].replace('Z', '+00:00')).timestamp()
                    require(report['mutationStartedEpoch'] <= created <= time.time(), 'New subscription outside this write window')
                    require(obj['metadata']['name'] not in original, 'Subscription existed before this run')
                    register('subscriptions', obj)
    save()
    restored = False
    try:
        report['identity'] = identity()
        for tool in Path(__file__).parent.iterdir():
            if tool.suffix in ['.py','.mjs']:(output / ('runner-' + tool.name)).write_bytes(tool.read_bytes())
        report['runnerDigests'] = {p.name: lab.digest(p) for p in Path(__file__).parent.iterdir() if p.suffix in ['.py', '.mjs']}
        client = lab.Client()
        guard.wait_for_stable_plugins(lambda: inventory(PLUGINS))
        user = client.api(CONSOLE + 'users/-')['user']
        require(user['metadata']['name'] == 'fixture-maintainer' and user['spec']['email'].endswith('.invalid'), 'Only synthetic maintainer allowed')
        report['notificationSafety'] = {**notifier_identity(), 'maintainerEmailInvalid': True, 'officialAllowNotificationUnchanged': True}
        plugin = client.api(PLUGINS + '/PluginCommentWidget')
        require(plugin['metadata'].get('creationTimestamp'), 'Plugin creation timestamp missing')
        plugin_original = plugin
        report['commentPluginInstance'] = {'creationTimestamp': plugin['metadata']['creationTimestamp'], 'specSha256': digest(plugin['spec'])}
        require(plugin['spec']['version'] == '3.3.2' and plugin['spec']['enabled'] and plugin['status']['phase'] == 'STARTED', 'Official comment plugin not ready')
        plugin_cfg = client.api('/api/v1alpha1/configmaps/' + plugin['spec']['configMapName'])['data']
        require(not json.loads(plugin_cfg.get('security', '{}')).get('captcha', {}).get('enable') and not json.loads(plugin_cfg.get('avatar', '{}')).get('enable'), 'This fixed batch requires captcha and external avatar disabled')
        settle_notifications('before')
        originals = inventory(NOTIFICATION + 'subscriptions')
        report['preserveExistingReplySubscription'] = any(o['spec'].get('reason', {}).get('reasonType') == 'someone-replied-to-you' and rotating_subscription(o, args.subject, True) for o in originals)
        report['originalSubscriptionNames'] = [o['metadata']['name'] for o in originals]
        report['originalSubscriptionSpecs'] = {o['metadata']['name']: {'creationTimestamp': o['metadata'].get('creationTimestamp'), 'specSha256': digest(o['spec'])} for o in originals if not o['metadata'].get('deletionTimestamp') and not rotating_post_subscription(o)}
        require(not any(post_name in json.dumps(o['spec']) for o in originals), 'Unique subject unexpectedly already subscribed')
        before = station();report['before'] = before
        original_config = client.api(CONFIG)
        original_comment = client.api(SYSTEM).get('data', {}).get('comment')
        lab.write_json(output / 'restore.private.json', {'theme': original_config, 'comment': original_comment}, private=True)
        config = json.loads(json.dumps(original_config));config.setdefault('comments', {}).update(lazyload=False, text=True, unavailable_notice='Owned comment plugin unavailable '+run)
        report['mutationStartedEpoch'] = time.time()
        changed = True
        client.api(CONFIG, 'PUT', config)
        system = client.api(SYSTEM);system.setdefault('data', {})['comment'] = json.dumps({**json.loads(original_comment or '{}'), 'enable': True, 'systemUserOnly': False, 'requireReviewForNew': False})
        client.api(SYSTEM, 'PUT', system)
        require(client.api(CONFIG) == config and client.api(SYSTEM)['data']['comment'] == system['data']['comment'], 'Config did not apply')
        if args.subject == 'Moment':
            require(client.api(PLUGINS + '/PluginMoments')['status']['phase'] == 'STARTED', 'Moment plugin must be enabled')
            html = '<h2>' + title + '</h2><p>Owned Moment acceptance.</p><a id="comment-usage-away" href="/">Leave this synthetic moment</a>'
            endpoint = collection_api('moments')
            require(optional(endpoint + '/' + post_name) is None, 'Unique Moment already exists')
            report['postCreationAttempted'] = True; save()
            client.api(endpoint, 'POST', {'apiVersion': 'moment.halo.run/v1alpha1', 'kind': 'Moment', 'metadata': {'name': post_name, 'labels': {OWNER: run}}, 'spec': {'content': {'raw': html, 'html': html, 'medium': []}, 'releaseTime': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'visible': 'PUBLIC', 'approved': True, 'owner': client.auth['username'], 'tags': []}})
            current = poll('Moment approval timestamp', lambda: client.api(endpoint + '/' + post_name), lambda x: bool(x['spec'].get('approvedTime')))
            require(current['spec']['approvedTime'] == current['metadata']['creationTimestamp'], 'Unexpected Moment approval timestamp')
            require(is_owned_content('moments', current) and current['spec']['content']['html'] == html, 'Moment identity/content differs')
            register('moments', current)
            url = lab.BASE['halo'] + '/moments/' + post_name
        else:
            require(optional(collection_api(subject_collection) + '/' + post_name) is None, 'Unique post already exists')
            report['postCreationAttempted'] = True;save()
            post = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': args.subject, 'metadata': {'name': post_name, 'labels': {OWNER: run}}, 'spec': {'title': title, 'slug': post_name, 'allowComment': True, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []}}
            html = '<h2>' + title + '</h2><p>Owned local comment acceptance fixture.</p><a id="comment-usage-away" href="/">Leave this synthetic article</a>'
            client.api(CONSOLE + subject_collection, 'POST', {('page' if args.subject == 'SinglePage' else 'post'): post, 'content': {'rawType': 'HTML', 'raw': html, 'content': html}})
            current = client.api(collection_api(subject_collection) + '/' + post_name)
            require(is_owned_content(subject_collection, current) and current['spec']['title'] == title and current['metadata'].get('creationTimestamp'), 'Post ownership mismatch')
            report['postIdentity'] = {'name': post_name, 'creationTimestamp': current['metadata']['creationTimestamp'], 'label': run, 'title': title};save()
            client.api(CONSOLE + subject_collection + '/' + post_name + '/publish', 'PUT')
            current = poll('post publication', lambda: client.api(collection_api(subject_collection) + '/' + post_name), lambda x: x['spec'].get('publish') and x.get('status', {}).get('permalink'))
            released = poll('published content', lambda: client.api(CONSOLE + subject_collection + '/' + post_name + '/release-content'), lambda x: x.get('content') == html and x.get('raw') == html)
            current = client.api(collection_api(subject_collection) + '/' + post_name)
            require(is_owned_content(subject_collection, current) and current['metadata']['creationTimestamp'] == report['postIdentity']['creationTimestamp'] and current['spec']['title'] == title, 'Post identity changed during publication')
            report['postReleaseSha256'] = digest(released)
            register(subject_collection, current)
            url = urllib.parse.urljoin(lab.BASE['halo'], current['status']['permalink'])
            require(urllib.parse.urlsplit(url).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc, 'Post origin mismatch')
        cookies = [{'name': c.name, 'value': c.value, 'domain': c.domain, 'path': c.path, 'expires': c.expires or -1, 'httpOnly': c.has_nonstandard_attr('HttpOnly'), 'secure': c.secure, 'sameSite': 'Lax'} for c in client.jar]
        lab.write_json(output / 'auth.private.json', {'cookies': cookies}, private=True)
        fixture = {'owner': OWNER, 'runId': run, 'runtime': str(runtime), 'base': lab.BASE['halo'], 'installed': report['identity']['installed'], 'haloJar': lab.HALO_JAR_NAME, 'post': {'kind': args.subject, 'group': subject_group, 'name': post_name, 'path': urllib.parse.urlsplit(url).path}, 'expectedCases': len(cases), 'cases': cases, 'scope': args.cases}
        if args.cases == 'lifecycle-only':
            # These are explicitly API-created reading fixtures, not evidence
            # of a user submitting or replying through the browser UI.
            fixture['lifecycleSeeds'] = []
            report['apiLifecycleFixtures'] = fixture['lifecycleSeeds']
            for pair_index in range(args.lifecycle_pairs):
                parent_text = 'API lifecycle parent ' + str(pair_index) + ' ' + run
                reply_text = 'API lifecycle reply ' + str(pair_index) + ' ' + run
                parent_html = '<p>' + parent_text + '</p>'
                reply_html = '<p>' + reply_text + '</p>'
                time.sleep(6.5)
                parent = client.api('/apis/api.halo.run/v1alpha1/comments', 'POST', {'raw': parent_html, 'content': parent_html, 'allowNotification': True, 'hidden': False, 'subjectRef': {'group': subject_group, 'version': 'v1alpha1', 'kind': args.subject, 'name': post_name}})
                require(parent['metadata'].get('creationTimestamp') and parent['spec']['subjectRef']['name'] == post_name and parent['spec']['raw'] == parent_html, 'API lifecycle parent mismatch')
                pair = {'parent': {'name': parent['metadata']['name'], 'creationTimestamp': parent['metadata']['creationTimestamp'], 'raw': parent_html, 'visibleText': parent_text}, 'notUiSubmissionEvidence': True}
                save()
                time.sleep(6.5)
                reply = client.api('/apis/api.halo.run/v1alpha1/comments/' + parent['metadata']['name'] + '/reply', 'POST', {'raw': reply_html, 'content': reply_html, 'allowNotification': True})
                require(reply['metadata'].get('creationTimestamp') and reply['spec']['commentName'] == parent['metadata']['name'] and reply['spec']['raw'] == reply_html, 'API lifecycle reply mismatch')
                pair['reply'] = {'name': reply['metadata']['name'], 'creationTimestamp': reply['metadata']['creationTimestamp'], 'raw': reply_html, 'visibleText': reply_text}
                fixture['lifecycleSeeds'].append(pair)
                save()
        lab.write_json(output / 'fixture.json', fixture)
        settle_notifications('ready')
        collect_children()
        report['ready'] = station();save()
        if args.cases == 'upload-natural':
            from natural import NaturalUploadBatch
            upload_batch = NaturalUploadBatch(client, lab, guard, fixture, output, register)
            upload_batch.run()
        elif args.cases in ['upload-only', 'upload-direct', 'upload-webkit-direct', 'upload-isolated']:
            from uploads import UploadBatch
            upload_batch = UploadBatch(client, lab, guard, fixture, output)
            upload_batch.run()
        elif args.cases in ['captcha-only', 'captcha-expiry']:
            from captcha import run_captcha
            run_captcha(client, lab, guard, fixture, output)
        elif args.cases == 'language-only':
            from language import run_language
            run_language(client, lab, guard, fixture, output, collection_api(subject_collection) + '/' + post_name)
        elif args.cases == 'access-only':
            from access import run_access
            run_access(client, lab, fixture, output, collection_api(subject_collection) + '/' + post_name)
        elif args.cases == 'policy-only':
            from policies import run_policies
            run_policies(client, lab, guard, fixture, output, collection_api(subject_collection) + '/' + post_name)
        else:
            if args.cases != 'lifecycle-only':
                browser('usage')
            collect_children()
            expected_children = args.lifecycle_pairs if args.cases == 'lifecycle-only' else len(cases)
            require(len([r for r in report['created'] if r['collection'] == 'comments']) == expected_children and len([r for r in report['created'] if r['collection'] == 'replies']) == expected_children, 'Expected exact declared parent/reply fixtures')
            plugin_state(False);browser('disabled')
            plugin_state(True);browser('restored')
        report['status'] = 'passed-tested-scope'
    except guard.BrowserCleanupError as error:
        report['browserCleanupFailed'] = True
        report['status'] = 'failed'; report['errors'].append({'stage': 'browser-cleanup', 'message': str(error)})
    except Exception as error:
        report['errors'].append({'stage': 'execution', 'type': type(error).__name__, 'message': str(error)})
        report['status'] = 'failed'
    finally:
        if client and changed and not report.get('browserCleanupFailed'):
            for label, action in [('plugin-enable', lambda: plugin_state(True)), ('collect-children', collect_children), ('notification-readiness', lambda: settle_notifications('before-side-effect-collection')), ('collect-notifications', collect_notifications)]:
                try:
                    action()
                except Exception as error:
                    report['errors'].append({'stage': label, 'message': str(error)})
            for row in reversed(report['created']):
                try:
                    endpoint = (NOTIFICATION + row['collection'] if row['collection'] in ['subscriptions', 'notifications', 'reasons'] else collection_api(row['collection'])) + '/' + row['name']
                    obj = optional(endpoint)
                    if obj:
                        require(obj['metadata'].get('creationTimestamp') == row['creationTimestamp'] and digest(obj['spec']) == row['specSha256'], 'Cleanup identity/spec mismatch')
                        client.api(endpoint, 'DELETE')
                        poll('delete ' + row['name'], lambda: optional(endpoint), lambda x: x is None)
                    report['cleanup'].append({**row, 'deleted': True})
                except Exception as error:
                    report['errors'].append({'stage': 'cleanup', 'name': row['name'], 'message': str(error)})
            if upload_batch:
                try:
                    upload_batch.cleanup()
                except Exception as error:
                    report['errors'].append({'stage': 'upload-cleanup', 'message': str(error)})
            for label in ['theme', 'system']:
                try:
                    if label == 'theme':
                        client.api(CONFIG, 'PUT', original_config)
                    else:
                        system = client.api(SYSTEM)
                        if original_comment is None:system['data'].pop('comment', None)
                        else:system['data']['comment'] = original_comment
                        client.api(SYSTEM, 'PUT', system)
                except Exception as error:
                    report['errors'].append({'stage': 'restore-' + label, 'message': str(error)})
            try:
                require(not report.get('postCreationAttempted') or any(r['collection'] == subject_collection for r in report['created']), 'Unregistered post creation needs manual inspection')
                settle_notifications('after-cleanup')
                report['after'] = station();report['identityAfter'] = identity()
                require(report['after'] == before and report['identityAfter'] == report['identity'], 'Original station/package not restored')
                require(len(report['cleanup']) == len(report['created']) and not any(is_owned_content('comments', x) for x in inventory(CONTENT + 'comments')), 'Incomplete owned cleanup')
                for name, original in report['originalSubscriptionSpecs'].items():
                    obj = optional(NOTIFICATION + 'subscriptions/' + name)
                    require(obj and obj['metadata'].get('creationTimestamp') == original['creationTimestamp'] and digest(obj['spec']) == original['specSha256'], 'Pre-existing subscription changed')
                require(not upload_batch or upload_batch.report.get('restored'), 'Upload storage restoration not verified')
                restored = True
            except Exception as error:
                report['errors'].append({'stage': 'restore-verify', 'message': str(error)})
        report['restorationVerified'] = restored
        report['lockReleased'] = restored or not changed
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        if report['errors']:report['status'] = 'failed'
        save()
        (output / 'auth.private.json').unlink(missing_ok=True)
        if report['lockReleased']:lock.unlink()
    print(json.dumps({'output': str(output), 'status': report['status'], 'restorationVerified': restored}))
    return 0 if report['status'] == 'passed-tested-scope' and restored else 1


if __name__ == '__main__':
    raise SystemExit(main())
