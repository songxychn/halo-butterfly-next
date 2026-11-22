#!/usr/bin/env python3
"""Stage release assets (theme ZIP, source archive, SHA256SUMS)."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from common import digest, run, version_key


def main():
    tag = sys.argv[1]
    version_key(tag)
    version = tag[1:]
    source = run('git', 'rev-parse', 'HEAD')
    if run('git', 'rev-parse', f'{tag}^{{commit}}') != source:
        raise ValueError('Checkout does not match release tag')
    if json.loads(Path('package.json').read_text())['version'] != version:
        raise ValueError('Tag/package version mismatch')
    package = Path('dist') / f'halo-butterfly-next-{version}.zip'
    if not package.is_file():
        raise ValueError('Missing verified theme archive')
    notes = Path('releases') / f'{tag}.md'
    if not notes.is_file() or len(notes.read_text().strip()) < 20:
        raise ValueError(f'Missing release notes: {notes}')
    out = Path('.runtime/release-assets')
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copyfile(package, out / package.name)
    archive = out / f'halo-butterfly-next-{version}-source.tar.gz'
    with archive.open('wb') as stream:
        subprocess.run(['git', 'archive', '--format=tar.gz', '--prefix=halo-butterfly-next/', 'HEAD'], stdout=stream, check=True)
    (out / 'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.name}\n' for p in sorted(out.iterdir())))


if __name__ == '__main__':
    main()
