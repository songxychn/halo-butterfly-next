#!/usr/bin/env python3
"""Push a versioned demo container image and update the :demo tag."""
import json
import subprocess
import sys
from pathlib import Path
from common import latest_tag, run, version_key


def main():
    tag, image = sys.argv[1:]
    version_key(tag)
    if latest_tag() != tag:
        raise RuntimeError('Newer release exists; skipping promotion')
    immutable = f'{image}:{tag}'
    subprocess.run(['docker', 'tag', 'demo-candidate', immutable], check=True)
    subprocess.run(['docker', 'push', immutable], check=True)
    subprocess.run(['docker', 'tag', immutable, f'{image}:demo'], check=True)
    subprocess.run(['docker', 'push', f'{image}:demo'], check=True)
    repo_digest = run('docker', 'image', 'inspect', immutable, '--format', '{{index .RepoDigests 0}}')
    identity = json.loads(Path('.runtime/demo-bundle/release.json').read_text())
    Path('.runtime/demo-promotion.json').write_text(json.dumps({
        'tag': tag,
        'image': repo_digest,
        'identity': identity,
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
