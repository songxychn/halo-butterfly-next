#!/usr/bin/env python3
"""Build the pinned upstream source plus the reviewed patch, without global tool changes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlsplit

BASE = 'ae278ec1be30bc197e99557090d62f34d76823de'
ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--work', type=Path, required=True, help='New empty checkout directory')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
work = args.work.resolve()
if work.exists():
    raise SystemExit('Build work directory must not exist')
patch = ROOT / '0001-theme-managed-resources.patch'
def run(*command, cwd=work, env=None):
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)
work.parent.mkdir(parents=True, exist_ok=True)
run('git', 'clone', 'https://github.com/halo-dev/plugin-comment-widget.git', work, cwd=work.parent)
run('git', 'checkout', '--detach', BASE)
run('git', 'apply', '--check', patch)
run('git', 'apply', patch)
flags = ['--no-daemon', '--max-workers=2']
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if proxy:
    url = urlsplit(proxy)
    if url.hostname and url.port and not url.username:
        for protocol in ['http', 'https']:
            flags += [f'-D{protocol}.proxyHost={url.hostname}', f'-D{protocol}.proxyPort={url.port}']
run('./gradlew', *flags, ':packages:pnpmSetup')
pnpm = work / 'packages/.gradle/pnpm/pnpm-v12.4.2/bin/pnpm'
if not pnpm.is_file():
    raise SystemExit('Pinned Gradle pnpm distribution missing')
run(pnpm, 'install', '--frozen-lockfile', cwd=work / 'packages')
run(pnpm, '-r', 'run', 'build', cwd=work / 'packages')
run('./gradlew', *flags, 'build', '-x', ':packages:pnpmBuild', '-x', ':packages:pnpmInstall')
jar = work / 'build/libs/plugin-comment-widget-3.4.0-theme-demand.1.jar'
args.output.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(jar, args.output)
proof = {'repository': 'https://github.com/halo-dev/plugin-comment-widget', 'baseCommit': BASE, 'patchSha256': hashlib.sha256(patch.read_bytes()).hexdigest(), 'version': '3.4.0-theme-demand.1', 'sha256': hashlib.sha256(jar.read_bytes()).hexdigest(), 'validation': 'Gradle build including tests, full frozen-lockfile frontend build'}
args.output.with_suffix('.build.json').write_text(json.dumps(proof, indent=2)+'\n')
print(json.dumps(proof))
