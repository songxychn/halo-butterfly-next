"""Shared release identity, tag ordering, and checksum helpers."""
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

REPO = os.environ.get('GITHUB_REPOSITORY', 'songxychn/halo-butterfly-next')
PATTERN = r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?'


def version_key(tag):
    m = re.fullmatch(PATTERN, tag)
    if not m:
        raise ValueError('Expected vX.Y.Z or vX.Y.Z-alpha.N/beta.N/rc.N')
    a, b, c, stage, n = m.groups()
    return (int(a), int(b), int(c), {'alpha': 0, 'beta': 1, 'rc': 2, None: 3}[stage], int(n or 0))


def newer(candidate, current):
    return version_key(candidate) > version_key(current)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def gh(path):
    return json.loads(run('gh', 'api', f'repos/{REPO}/{path}'))


def eligible_releases():
    result = []
    for page in range(1, 101):
        rows = gh(f'releases?per_page=100&page={page}')
        for r in rows:
            if r['draft']:
                continue
            try:
                version_key(r['tag_name'])
            except ValueError:
                continue
            result.append(r)
        if len(rows) < 100:
            return result
    raise RuntimeError('Release pagination exceeded bound')


def latest_tag():
    rows = eligible_releases()
    return max((r['tag_name'] for r in rows), key=version_key) if rows else None


def verify_asset_directory(output, asset_names, tag):
    version_key(tag)
    package = f'halo-butterfly-next-{tag[1:]}.zip'
    source_archive = f'halo-butterfly-next-{tag[1:]}-source.tar.gz'
    required = {package, source_archive}
    expected_names = required | {'SHA256SUMS'}
    if not expected_names.issubset(set(asset_names)):
        raise ValueError('Missing expected release assets')
    sums = {}
    for line in (output / 'SHA256SUMS').read_text().splitlines():
        if not line.strip():
            continue
        sha, name = line.split('  ', 1)
        if not re.fullmatch('[a-f0-9]{64}', sha) or name in sums:
            raise ValueError('Invalid checksum line')
        if name in required and digest(output / name) != sha:
            raise ValueError(f'Published checksum mismatch: {name}')
        sums[name] = sha
    if not required.issubset(set(sums)):
        raise ValueError('Incomplete checksum manifest')
    return {'tag': tag, 'themeSha256': digest(output / package), 'sourceArchiveSha256': digest(output / source_archive)}
