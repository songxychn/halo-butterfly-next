#!/usr/bin/env python3
"""Fixed-version reader client: direct RSS fetch, SQLite persistence, and read state.

The parent owns this run directory and supplies a frozen JSON plan. This uses the
public reader API; it is a real reader-library integration, not a GUI-client test.
"""
import argparse
from dataclasses import asdict
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import urllib.parse

REPO = Path(__file__).resolve().parents[2]
VERSION = '3.26'


def require(value, message):
    if not value:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, type=Path)
    args = parser.parse_args()
    plan_path = args.plan.resolve(strict=True)
    require(plan_path.is_relative_to(REPO / '.runtime'), 'Owned runtime plan required')
    plan = json.loads(plan_path.read_text())
    require(plan['owner'] == 'halo-butterfly-next-feed-followup', 'Unexpected plan owner')
    output = plan_path.parent
    db = output / ('reader-fresh.sqlite' if plan['phase'] == 'private-fresh' else 'reader.sqlite')
    url = urllib.parse.urlsplit(plan['feedUrl'])
    require(url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port and url.path == '/rss.xml' and not url.query and not url.fragment and not url.username, 'Owned loopback feed required')
    require(importlib.metadata.version('reader') == VERSION, 'Expected fixed reader version ' + VERSION)
    # Only bypass process proxy configuration for the loopback origin; no server
    # connection tuning, custom transport, or user-agent fallback plugin is introduced.
    os.environ['NO_PROXY'] = os.environ['no_proxy'] = '127.0.0.1,localhost'
    from reader import make_reader
    result = {'schema': 1, 'phase': plan['phase'], 'client': 'reader', 'version': VERSION,
              'feedUrl': plan['feedUrl'], 'database': db.name, 'status': 'running', 'readerPlugins': [],
              'limitations': ['Reader library with persistent SQLite and public APIs; no desktop/mobile reader UI claim.',
                              'Previously downloaded public content can remain in a reader after the publisher makes it private.']}
    try:
        fresh = plan['phase'] in ('initial', 'private-fresh')
        require(db.exists() != fresh, 'Reader database existence differs from fixed phase plan')
        with make_reader(str(db), session_timeout=(5, 20), search_enabled=False, plugins=[]) as client:
            if fresh:
                client.add_feed(plan['feedUrl'])
            update = client.update_feed(plan['feedUrl'])
            feed = client.get_feed(plan['feedUrl'])
            require(feed.last_exception is None, 'Reader feed update reports a failure')
            entries = list(client.get_entries(feed=plan['feedUrl']))
            require(len({entry.id for entry in entries}) == len(entries), 'Duplicate reader entry IDs')
            result['update'] = asdict(update) if update is not None else None
            result['feedTitle'] = feed.title
            result['totalEntries'] = len(entries)
            rows = []
            for entry in entries:
                if plan['runId'] in (entry.link or '') or plan['runId'] in (entry.title or ''):
                    rows.append({'id': entry.id, 'link': entry.link, 'title': entry.title, 'summary': entry.summary,
                                 'content': [{'value': part.value, 'type': part.type} for part in entry.content],
                                 'read': entry.read, 'updated': str(entry.updated) if entry.updated else None})
            result['syntheticEntries'] = rows
            links = {entry.link for entry in entries}
            require(not set(plan['excluded']).intersection(links), 'Private/draft content leaked to this reader')
            expected = plan.get('publicUrl')
            if expected:
                matches = [entry for entry in entries if entry.link == expected]
                require(len(matches) == 1, 'Expected exactly one public reader entry')
                entry = matches[0]
                require(entry.title == plan['title'], 'Reader title differs from published value')
                body = '\n'.join([entry.summary or ''] + [part.value for part in entry.content])
                require(plan['bodyMarker'] in body, 'Reader article text differs from published value')
                if plan['phase'] == 'initial':
                    client.mark_entry_as_read(entry)
                    require(client.get_entry(entry).read is True, 'Reader did not persist mark-read')
                else:
                    require(entry.read is True, 'Reader lost read state across update/process reopen')
                result['entryId'] = entry.id
                result['readAfter'] = client.get_entry(entry).read
        result['status'] = 'passed'
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = {'type': type(error).__name__, 'message': str(error)}
    result['runnerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if db.exists():
        result['databaseSha256'] = hashlib.sha256(db.read_bytes()).hexdigest()
    report = output / ('reader-' + plan['phase'] + '.json')
    with report.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, default=str)
        stream.write('\n')
    print(json.dumps({'status': result['status'], 'report': str(report)}))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
