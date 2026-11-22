#!/usr/bin/env python3
"""Download and verify a published release theme archive."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from common import REPO, digest, gh, latest_tag, run, verify_asset_directory, version_key


def main():
    tag = sys.argv[1]
    version_key(tag)
    if latest_tag() != tag:
        raise RuntimeError('Only the newest published version may promote the demo')
    release = gh(f'releases/tags/{tag}')
    if release['draft']:
        raise RuntimeError('Cannot deploy a draft')
    output = Path('.runtime/published')
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    subprocess.run(['gh', 'release', 'download', tag, '--repo', REPO, '--dir', str(output)], check=True)
    package = f'halo-butterfly-next-{tag[1:]}.zip'
    verify_asset_directory(output, [a['name'] for a in release['assets']], tag)
    source = run('git', 'rev-parse', 'HEAD')
    if json.loads(Path('package.json').read_text())['version'] != tag[1:]:
        raise RuntimeError('Tag version mismatch')
    asset = next(a for a in release['assets'] if a['name'] == package)
    (output / 'release-identity.json').write_text(json.dumps({
        'releaseId': release['id'],
        'themeAssetId': asset['id'],
        'tag': tag,
        'sourceSha': source,
        'themeSha256': digest(output / package),
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
