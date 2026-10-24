#!/usr/bin/env python3
"""Bounded installed-theme combination check on an already-running owned Halo.

Creates API fixtures only. Never starts services, changes plugins, retries browser
measurements, or applies a connection workaround. Run after other lab mutations.
"""
import argparse
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

REPO = Path(__file__).resolve().parents[3]
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
CONFIG = CONSOLE + 'themes/halo-butterfly-next/json-config'
SYSTEM = '/api/v1alpha1/configmaps/system'
PLUGINS = '/apis/plugin.halo.run/v1alpha1/plugins'
OWNER = 'combination-followup-owner'
LOCKS = {
    'PluginCommentWidget': ('3.3.2', 'e569a4bd8aade89383c8c7fee169fd822cfa80ff01341fdaa292cd2cd9db8f3f'),
    'plugin-katex': ('3.0.0', 'e444781b99c23b020fcc379f6859ce67dc7669536c880004f7bf7cce0ed2df96'),
    'PluginMoments': ('1.18.0', 'f4f5fd5a35fffca6da80405b72546aa5ce55601c240c353fd63fc9dfbe1e41bc'),
    'PluginLinks': ('2.3.0', '96ec593d97912f6f3069cc184004389459ac842cea20212eb664c2ca19862f86'),
}
COLLECTIONS = {
    'post': '/apis/content.halo.run/v1alpha1/posts',
    'page': '/apis/content.halo.run/v1alpha1/singlepages',
    'moment': '/apis/moment.halo.run/v1alpha1/moments',
    'group': '/apis/core.halo.run/v1alpha1/linkgroups',
    'link': '/apis/core.halo.run/v1alpha1/links',
}


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def require(value, message):
    if not value:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--profile', choices=['six-cases', 'webkit-dark-diagnostic', 'six-cases-attributed'], default='six-cases')
    parser.add_argument('--viewport', choices=['mobile', 'desktop'], default='mobile')
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve(strict=True)
    require(runtime.is_relative_to(REPO / '.runtime'), 'Owned runtime outside worktree')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1, 'Wrong ownership marker')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('combination_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    run = secrets.token_hex(10)
    output = runtime / 'combination-followup' / run
    lock = runtime / 'acceptance-combinations.lock'
    require(not (runtime / 'authored-image-editor.lock').exists(), 'Editor/lifecycle run is active')
    with lock.open('x') as stream:
        stream.write(run)
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    report = {'schema': 1, 'runId': run, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'running', 'created': [], 'cleanup': [], 'errors': [], 'limitations': [
        'API-created official-renderer MathML, not editor UI recording or formula resave acceptance.',
        'Six headless light/dark native-navigation combinations at the recorded viewport with retained official scripts; no PJAX disposal claim; no physical device, Safari application, assistive technology, external accounts, or full contract.',
        'Comment widget reading and subject switching only; no comment submission/reply, plugin lifecycle or deferred resource-on-demand claims.',
        'All failures retained; browser navigation is never retried and original 20s/30s readiness limits remain.',
        'No product changes, plugin changes, runtime restart, connection workaround, or performance-budget measurement.']}
    report['profile'] = args.profile
    report['viewport'] = args.viewport
    if args.profile == 'webkit-dark-diagnostic':
        report['limitations'][1] = 'One instrumented WebKit dark mobile diagnostic, not a replacement six-case acceptance batch or a retry of its result.'
    if args.profile == 'six-cases-attributed':
        report['limitations'].append('Six fixed acceptance cases with additional public observations and private protocol logging; strict errors remain failures. Exact loader attribution is available only from the separately extracted WebKit segment; not a performance sample.')
    client = None
    protocol_stream = None
    original_config = original_system = before = None
    config_changed = system_changed = False
    restored = False
    def save():
        lab.write_json(output / 'report.json', report)
    def optional(url):
        try:
            return client.api(url)
        except lab.ApiError as error:
            if error.status != 404:
                raise
    def inventory(url):
        data = client.api(url + '?size=200')
        require(data.get('total', len(data['items'])) <= 200 and not data.get('hasNext'), 'Inventory exceeds fixed bound')
        return data['items']
    def identity():
        require(lab.owned_process('halo'), 'No live owned process')
        state = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo' / lab.HALO_JAR_NAME
        command = subprocess.check_output(['ps', '-p', str(state['pid']), '-o', 'command='], text=True)
        require(state['identity'] == str(jar) and str(jar) in command and str(runtime / 'halo/data') in command, 'Process identity mismatch')
        require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
        require(lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo JAR mismatch')
        package = args.package.resolve(strict=True)
        require(package.is_relative_to(REPO), 'Package outside worktree')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == lab.digest(package), 'Installed package attribution mismatch')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', 'src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(package) as archive:
            files = [n for n in archive.namelist() if not n.endswith('/')]
            require(len(files) == len(set(files)) == 269, 'Expected 269 unique theme files')
            root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
            for name in files:
                target = (root / name).resolve()
                require(target.is_relative_to(root) and target.read_bytes() == archive.read(name), 'Installed theme bytes differ: ' + name)
        jars = {p.name: lab.digest(p) for p in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        for name, (_, sha) in LOCKS.items():
            require(sha in jars.values(), 'Pinned official plugin JAR missing: ' + name)
        return {'installed': installed, 'haloSha256': lab.digest(jar), 'packageFiles': len(files), 'pluginJars': jars}
    def station():
        active = client.api(CONSOLE + 'themes/-/activation')
        require(active['metadata']['name'] == 'halo-butterfly-next', 'Unexpected active theme')
        plugins = []
        for obj in sorted(inventory(PLUGINS), key=lambda x: x['metadata']['name']):
            config = optional('/api/v1alpha1/configmaps/' + urllib.parse.quote(obj['spec']['configMapName'], safe='')) if obj['spec'].get('configMapName') else None
            plugins.append({'name': obj['metadata']['name'], 'version': obj['spec']['version'], 'enabled': obj['spec'].get('enabled'), 'phase': obj.get('status', {}).get('phase'), 'specSha256': digest(obj['spec']), 'configSha256': digest(config.get('data', {})) if config else None})
        contents = {}
        for kind, endpoint in COLLECTIONS.items():
            rows = []
            for obj in inventory(endpoint):
                if any(r['kind'] == kind and r['name'] == obj['metadata']['name'] and obj['metadata'].get('labels', {}).get(OWNER) == run for r in report['created']):
                    continue
                row = {'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': digest(obj['spec'])}
                if kind in ('post', 'page') and obj['spec'].get('publish'):
                    plural = 'posts' if kind == 'post' else 'singlepages'
                    released = client.api(CONSOLE + plural + '/' + obj['metadata']['name'] + '/release-content')
                    row['releaseSha256'] = digest(released)
                rows.append(row)
            contents[kind] = sorted(rows, key=lambda x: x['name'])
        return {'activeTheme': {'name': active['metadata']['name'], 'version': active['spec']['version']}, 'themeConfigSha256': digest(client.api(CONFIG)), 'systemDataSha256': digest(client.api(SYSTEM).get('data', {})), 'plugins': plugins, 'contents': contents}
    def check_owned(obj, row):
        require(obj['metadata']['name'] == row['name'] and obj['metadata'].get('labels', {}).get(OWNER) == run, 'Ownership mismatch')
        require(obj['metadata'].get('creationTimestamp') == row['creationTimestamp'], 'Creation timestamp changed')
        require(digest(obj['spec']) == row['specSha256'], 'Fixture spec changed unexpectedly')
    def register(kind, body, console_body=None):
        name = body['metadata']['name']
        endpoint = COLLECTIONS[kind]
        require(optional(endpoint + '/' + name) is None, 'Unique fixture name already exists')
        row = {'kind': kind, 'name': name, 'creationTimestamp': None, 'specSha256': None}
        report['created'].append(row)
        save()
        client.api(CONSOLE + 'posts' if console_body else endpoint, 'POST', console_body or body)
        obj = client.api(endpoint + '/' + name)
        require(obj['metadata']['name'] == name, 'Created name mismatch')
        require(obj['metadata'].get('labels', {}).get(OWNER) == run, 'Created label mismatch')
        require(bool(obj['metadata'].get('creationTimestamp')), 'Server creationTimestamp missing')
        if 'owner' in body['spec']:
            require(obj['spec'].get('owner') == body['spec']['owner'], 'Created owner mismatch')
        row.update(creationTimestamp=obj['metadata']['creationTimestamp'], specSha256=digest(obj['spec']))
        save()
        if kind == 'moment':
            # Official Moments 1.18.0 reconciler adds approvedTime to approved
            # content asynchronously. Observe that exact normalization before
            # freezing the strict deletion identity; never drop it at cleanup.
            original_spec = json.loads(json.dumps(obj['spec']))
            normalization = {'before': original_spec, 'beforeSha256': digest(original_spec), 'allowedAddition': 'approvedTime', 'polls': [], 'limitSeconds': 20}
            row['normalization'] = normalization
            deadline = time.monotonic() + 20
            while True:
                require(time.monotonic() < deadline, 'Moment normalization observation deadline exceeded')
                current = client.api(endpoint + '/' + name)
                require(time.monotonic() < deadline, 'Moment normalization response arrived after the 20-second deadline')
                require(current['metadata']['name'] == name and current['metadata'].get('labels', {}).get(OWNER) == run and current['metadata'].get('creationTimestamp') == row['creationTimestamp'], 'Moment identity changed during normalization')
                current_spec = current['spec']
                approved_time = current_spec.get('approvedTime')
                comparable = json.loads(json.dumps(current_spec))
                if 'approvedTime' not in original_spec:
                    comparable.pop('approvedTime', None)
                require(comparable == original_spec, 'Moment changed beyond official approvedTime normalization')
                version = current['metadata'].get('version')
                observed = current.get('status', {}).get('observedVersion')
                normalization['polls'].append({'specSha256': digest(current_spec), 'approvedTime': approved_time, 'version': version, 'observedVersion': observed})
                save()
                if isinstance(approved_time, str) and approved_time and version is not None and observed == version:
                    normalization.update(after=current_spec, afterSha256=digest(current_spec), completed=True)
                    row['specSha256'] = digest(current_spec)
                    save()
                    break
                require(time.monotonic() < deadline, 'Moment official normalization did not converge within 20 seconds')
                time.sleep(.25)
        return row
    def object_(kind, api, name, value):
        return {'kind': kind, 'apiVersion': api, 'metadata': {'name': name, 'labels': {OWNER: run}}, 'spec': value}
    save()
    try:
        report['identity'] = identity()
        report['runnerDigests'] = {p.name: lab.digest(p) for p in Path(__file__).parent.iterdir() if p.suffix in ('.py', '.mjs')}
        client = lab.Client()
        before = station()
        report['before'] = before
        for name, (version, _) in LOCKS.items():
            plugin = next((p for p in before['plugins'] if p['name'] == name), None)
            require(plugin and plugin['version'] == version and plugin['enabled'] is True and plugin['phase'] == 'STARTED', 'Required official plugin not STARTED: ' + name)
        probe = next((p for p in before['plugins'] if p['name'] == 'plugin-halo-butterfly-layout-probe'), None)
        require(probe is None or (probe['enabled'] is False and probe['phase'] == 'DISABLED'), 'Layout-probe must already be DISABLED; no experimental plugin coverage')
        katex = client.api(PLUGINS + '/plugin-katex')
        katex_config = optional('/api/v1alpha1/configmaps/' + katex['spec']['configMapName'])
        basic = json.loads((katex_config or {}).get('data', {}).get('basic', '{}'))
        require(basic.get('enable_frontend_katex') not in (True, 'true'), 'Default editor MathML requires frontend rendering disabled')
        original_config = client.api(CONFIG)
        original_system = client.api(SYSTEM).get('data', {}).get('comment')
        lab.write_json(output / 'restore.private.json', {'themeConfig': original_config, 'systemComment': original_system}, private=True)
        config = json.loads(json.dumps(original_config))
        config.setdefault('pjax', {}).update(enable=True, exclude='')
        config.setdefault('comments', {}).update(lazyload=False, jump=True)
        config.setdefault('math', {}).update(enable=True, copy_tex=True)
        config.setdefault('render', {}).update(enable_code=True, enable_code_copy=True)
        config.setdefault('links', {}).update(source='', random_order=False)
        config_changed = True
        client.api(CONFIG, 'PUT', config)
        require(client.api(CONFIG) == config, 'Theme config did not apply')
        system = client.api(SYSTEM)
        system['data']['comment'] = json.dumps({**json.loads(original_system or '{}'), 'enable': True})
        system_changed = True
        client.api(SYSTEM, 'PUT', system)
        require(client.api(SYSTEM)['data']['comment'] == system['data']['comment'], 'Comment enable did not apply')
        katex_jar = next(p for p in (runtime / 'halo/data/plugins').glob('*.jar') if lab.digest(p) == LOCKS['plugin-katex'][1])
        with zipfile.ZipFile(katex_jar) as archive:
            (output / 'katex.cjs').write_bytes(archive.read('static/katex.min.js'))
        render = "const k=require(process.argv[1]);if(k.version!=='0.16.25')throw Error('renderer version');console.log(k.renderToString('x^2 + y^2 = z^2',{output:'mathml',displayMode:true,throwOnError:false,strict:false,maxSize:300}));"
        math = subprocess.check_output(['bun', '-e', render, str(output / 'katex.cjs')], cwd=REPO, text=True).strip()
        title = 'Combination ' + run
        html = '<h2>' + title + '</h2><div id="combo-math" class="katex-block">' + math + '</div><pre><code class="language-javascript">const combination = 1;</code></pre><picture id="combo-picture"><source media="(max-width:600px)" srcset="/lab/avatar.svg"><img src="/lab/avatar.svg" alt="' + title + '" loading="eager" width="100" height="100"></picture>'
        (output / 'fixture.html').write_text(html)
        name = 'combination-' + run
        post = object_('Post', 'content.halo.run/v1alpha1', name, {'title': title, 'slug': name, 'allowComment': True, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []})
        row = register('post', post, {'post': post, 'content': {'rawType': 'HTML', 'raw': html, 'content': html}})
        draft = client.api(COLLECTIONS['post'] + '/' + name)
        check_owned(draft, row)
        require(all(draft['spec'].get(key) == value for key, value in post['spec'].items()), 'Created post differs from requested fixture')
        draft_spec = draft['spec']
        # Halo 2.26.1 PostServiceImpl.publish sets publish/releaseSnapshot,
        # filling a missing headSnapshot from baseSnapshot. PostReconciler may
        # add publishTime. No other fixture spec changes are accepted here.
        publication_fields = {'publish', 'headSnapshot', 'releaseSnapshot', 'publishTime'}
        expected_snapshot = draft_spec.get('headSnapshot') or draft_spec.get('baseSnapshot')
        require(isinstance(expected_snapshot, str) and expected_snapshot, 'Draft snapshot missing')
        publication = {'before': draft_spec, 'allowedChanges': sorted(publication_fields), 'limitSeconds': 20, 'polls': []}
        row['publication'] = publication
        save()
        def check_publication(obj):
            require(obj['metadata']['name'] == name and obj['metadata'].get('labels', {}).get(OWNER) == run, 'Published ownership changed')
            require(obj['metadata'].get('creationTimestamp') == row['creationTimestamp'], 'Published creation timestamp changed')
            value = obj['spec']
            require(value.get('owner') == post['spec']['owner'], 'Published owner changed')
            require({k: v for k, v in value.items() if k not in publication_fields} == {k: v for k, v in draft_spec.items() if k not in publication_fields}, 'Post changed beyond official publication fields')
            require(value.get('publish') is True and value.get('headSnapshot') == expected_snapshot and value.get('releaseSnapshot') == expected_snapshot, 'Published snapshot differs from original draft')
            if draft_spec.get('publishTime') is not None:
                require(value.get('publishTime') == draft_spec['publishTime'], 'Existing publishTime changed')
            return isinstance(value.get('publishTime'), str) and bool(value['publishTime']) and bool(obj.get('status', {}).get('permalink'))
        deadline = time.monotonic() + 20
        client.api(CONSOLE + 'posts/' + name + '/publish', 'PUT')
        while True:
            require(time.monotonic() < deadline, 'Post publication exceeded 20-second deadline')
            current = client.api(COLLECTIONS['post'] + '/' + name)
            require(time.monotonic() < deadline, 'Post publication response arrived after deadline')
            ready = check_publication(current)
            released = optional(CONSOLE + 'posts/' + name + '/release-content') if ready else None
            require(time.monotonic() < deadline, 'Released content response arrived after deadline')
            matches = bool(released and released.get('raw') == html and released.get('content') == html)
            publication['polls'].append({'specSha256': digest(current['spec']), 'publicationReady': ready, 'releasedContentMatches': matches, 'releaseSha256': digest(released) if released else None})
            save()
            if ready and matches:
                # Freeze cleanup identity only after the actual published body
                # is available, then independently recheck the latest object.
                current = client.api(COLLECTIONS['post'] + '/' + name)
                require(time.monotonic() < deadline, 'Final post identity arrived after deadline')
                require(check_publication(current), 'Final published post is not ready')
                publication.update(after=current['spec'], releaseSha256=digest(released), completed=True)
                row['specSha256'] = digest(current['spec'])
                save()
                break
            time.sleep(.25)
        post_url = urllib.parse.urljoin(lab.BASE['halo'], current['status']['permalink'])
        require(urllib.parse.urlsplit(post_url).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc, 'Post permalink origin mismatch')
        moment = 'combination-moment-' + run
        register('moment', object_('Moment', 'moment.halo.run/v1alpha1', moment, {'content': {'raw': title, 'html': '<p>' + title + '</p>', 'medium': []}, 'releaseTime': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'visible': 'PUBLIC', 'approved': True, 'owner': client.auth['username'], 'tags': ['combination']}))
        group = 'combination-group-' + run
        register('group', object_('LinkGroup', 'core.halo.run/v1alpha1', group, {'displayName': title, 'priority': 0}))
        register('link', object_('Link', 'core.halo.run/v1alpha1', 'combination-link-' + run, {'displayName': title, 'url': post_url, 'logo': lab.BASE['halo'] + '/lab/avatar.svg', 'description': title, 'groupName': group, 'priority': 0}))
        fixture = {'viewport': {'width': 390, 'height': 844} if args.viewport == 'mobile' else {'width': 1440, 'height': 1000}, 'haloVersion': lab.HALO_VERSION, 'haloSha256': lab.VERSIONS['halo']['sha256'], 'owner': OWNER, 'runId': run, 'base': lab.BASE['halo'], 'runtime': str(runtime), 'installed': report['identity']['installed'], 'post': {'name': name, 'path': urllib.parse.urlsplit(post_url).path}, 'moment': {'name': moment, 'path': '/moments/' + moment}, 'linkTitle': title, 'tex': 'x^2 + y^2 = z^2', 'expectedCases': 1 if args.profile == 'webkit-dark-diagnostic' else 6, 'profile': args.profile}
        lab.write_json(output / 'fixture.json', fixture)
        report['ready'] = station()
        save()
        # This process group belongs only to the browser batch; the Halo JVM was
        # already running and is never part of it. A timeout is a failed batch,
        # not a reason to retry any measurement.
        browser_env = dict(os.environ)
        if args.profile in ('webkit-dark-diagnostic', 'six-cases-attributed'):
            # Official Playwright logging only: never patch the browser or its
            # protocol. Raw messages may include session data; keep them private.
            protocol_path = output / 'protocol.private.log'
            protocol_stream = os.fdopen(os.open(protocol_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w')
            browser_env.update(DEBUG='pw:protocol', DEBUG_COLORS='0')
            # The caller's debug-file/truncation preferences must not divert or
            # truncate this explicit private evidence stream.
            browser_env.pop('DEBUG_FILE', None)
            browser_env.pop('MAX_LOG_LENGTH', None)
            report['protocolLog'] = protocol_path.name
        browser = subprocess.Popen(['bun', str(Path(__file__).with_name('check.mjs')), str(output / 'fixture.json')], cwd=REPO, env=browser_env, stderr=protocol_stream, start_new_session=True)
        report['browserProcessGroup'] = browser.pid
        report['browserTimeoutSeconds'] = 1800
        save()
        try:
            browser.wait(timeout=1800)
        except subprocess.TimeoutExpired:
            report['browserTimedOut'] = True
            try:
                os.killpg(browser.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                browser.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
            # Kill any same-group child still alive even if the Bun parent has
            # already exited after TERM. The group was created by this batch.
            try:
                os.killpg(browser.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            browser.wait(timeout=10)
            raise RuntimeError('Browser batch exceeded fixed 1800s limit; process group terminated; no retry')
        report['browserExitCode'] = browser.returncode
        require(browser.returncode == 0, 'Browser batch failed; preserved its report')
        report['status'] = 'passed-tested-scope'
    except Exception as error:
        report['errors'].append({'stage': 'execution', 'type': type(error).__name__, 'message': str(error)})
        report['status'] = 'failed'
    finally:
        if protocol_stream:
            protocol_stream.close()
            report['protocolSha256'] = lab.digest(output / 'protocol.private.log')
        if client:
            for row in reversed(report['created']):
                try:
                    endpoint = COLLECTIONS[row['kind']] + '/' + row['name']
                    current = optional(endpoint)
                    if current:
                        require(row['creationTimestamp'] is not None and row['specSha256'] is not None, 'Unregistered creation: manual owned-fixture inspection required')
                        check_owned(current, row)
                        client.api(endpoint, 'DELETE')
                        for _ in range(80):
                            if optional(endpoint) is None:
                                break
                            time.sleep(.25)
                        require(optional(endpoint) is None, 'Owned fixture deletion did not converge')
                    report['cleanup'].append({'kind': row['kind'], 'name': row['name'], 'deleted': True})
                except Exception as error:
                    report['errors'].append({'stage': 'cleanup', 'name': row['name'], 'message': str(error)})
            for name, changed, action in [
                ('theme', config_changed, lambda: client.api(CONFIG, 'PUT', original_config)),
                ('system', system_changed, None),
            ]:
                if changed:
                    try:
                        if name == 'theme':
                            action()
                        else:
                            system = client.api(SYSTEM)
                            if original_system is None:
                                system['data'].pop('comment', None)
                            else:
                                system['data']['comment'] = original_system
                            client.api(SYSTEM, 'PUT', system)
                    except Exception as error:
                        report['errors'].append({'stage': 'restore-' + name, 'message': str(error)})
            if before:
                try:
                    report['after'] = station()
                    report['identityAfter'] = identity()
                    require(report['after'] == before and report['identityAfter'] == report['identity'], 'Station identity did not restore')
                    require(len(report['cleanup']) == len(report['created']) and all(x['deleted'] for x in report['cleanup']), 'Not every created fixture was cleaned')
                    restored = True
                except Exception as error:
                    report['errors'].append({'stage': 'restore-verify', 'message': str(error)})
        if report['errors']:
            report['status'] = 'failed'
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        # A failed preflight without mutations is safe to unlock. Once any
        # mutation is attempted, the lock remains until cleanup and complete
        # station/package verification both succeed, even if browser tests pass.
        no_mutations = not report['created'] and not config_changed and not system_changed
        report['lockReleased'] = restored or no_mutations
        report['restorationVerified'] = restored
        save()
        require(lock.read_text() == run, 'Lock ownership changed')
        if report['lockReleased']:
            lock.unlink()
        else:
            print('Lock retained for explicit restoration inspection:', lock)
    print(report['status'], output / 'report.json')
    return 0 if report['status'] == 'passed-tested-scope' else 1


if __name__ == '__main__':
    raise SystemExit(main())
