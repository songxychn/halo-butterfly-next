#!/usr/bin/env python3
"""Create or finish publishing a GitHub Release with staged assets."""
import subprocess
import sys
from pathlib import Path
from common import REPO, gh, version_key


def find_release(tag):
    for page in range(1, 101):
        rows = gh(f'releases?per_page=100&page={page}')
        record = next((r for r in rows if r['tag_name'] == tag), None)
        if record is not None:
            return record
        if len(rows) < 100:
            return None
    raise RuntimeError('Release pagination exceeded bound')


def main():
    tag = sys.argv[1]
    version_key(tag)
    expected = Path('.runtime/release-assets')
    files = sorted(expected.iterdir())
    current = find_release(tag)
    if current is None:
        cmd = [
            'gh', 'release', 'create', tag,
            '--repo', REPO,
            '--verify-tag',
            '--title', tag,
            '--notes-file', f'releases/{tag}.md',
        ]
        if '-' in tag:
            cmd.append('--prerelease')
        cmd.extend(str(f) for f in files)
        subprocess.run(cmd, check=True)
        print(f'Published release {tag}')
        return
    existing = {a['name'] for a in current['assets']}
    for file in files:
        if file.name not in existing:
            subprocess.run(['gh', 'release', 'upload', tag, str(file), '--repo', REPO], check=True)
    if current['draft']:
        subprocess.run(['gh', 'release', 'edit', tag, '--repo', REPO, '--draft=false'], check=True)
    print(f'Published release {tag}: {current["html_url"]}')


if __name__ == '__main__':
    main()
