#!/usr/bin/env python3
"""Serial, synthetic real-Halo / pinned-Hexo home-layout acceptance."""
import argparse
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'scripts/lab'))
import lab


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--baseline', action='store_true')
    parser.add_argument('--reference-runtime', choices=['bun', 'node'], default='bun')
    parser.add_argument('--engines', default='chromium,firefox,webkit')
    parser.add_argument('--cases', help='Optional comma-separated subset for a focused diagnostic run')
    args = parser.parse_args()
    engines = args.engines.split(',')
    if not engines or any(x not in ['chromium', 'firefox', 'webkit'] for x in engines):
        raise RuntimeError('Only independently installed automation engines are allowed')
    if not os.environ.get('LAB_RUNTIME'):
        raise RuntimeError('Explicit LAB_RUNTIME is required')
    installed = json.loads((lab.RUNTIME / 'installed-package.json').read_text())
    if installed['sourceCommit'] != args.source_sha or installed['sha256'] != lab.digest(args.package):
        raise RuntimeError('Source/package identity differs from installed package')
    upstream = lab.RUNTIME / 'hexo/themes/butterfly'
    if subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip() != lab.VERSIONS['butterfly']['commit']:
        raise RuntimeError('Reference theme is not the fixed upstream SHA')
    if subprocess.check_output(['git', '-C', str(upstream), 'status', '--porcelain'], text=True):
        raise RuntimeError('Reference source must remain clean')
    output = Path(args.output).resolve()
    output.relative_to(REPO / '.runtime')
    output.mkdir(parents=True, exist_ok=False)
    client = lab.Client()
    api = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
    original = client.api(api)
    cfg_file = lab.RUNTIME / 'hexo/_config.butterfly.yml'
    cfg_bytes = cfg_file.read_bytes()
    cfg = json.loads(cfg_bytes)
    base = {'sourceSha': args.source_sha, 'artifactSha256': installed['sha256'], 'upstreamSha': lab.VERSIONS['butterfly']['commit'], 'haloVersion': lab.VERSIONS['halo']['version'], 'referenceRuntime': args.reference_runtime}
    cases = ([('legacy-list', '', 'list', 3), ('legacy-tile', '', 'tile', 6)] if args.baseline else
             [(f'layout-{n}', str(n), 'list', n) for n in range(1, 8)] +
             [('legacy-list', '', 'list', 3), ('legacy-tile', '', 'tile', 6), ('invalid-tile', 'invalid', 'tile', 6),
              ('no-cover-5', '5', 'list', 5), ('no-cover-7', '7', 'list', 7), ('no-excerpt-6', '6', 'list', 6),
              ('no-top-6', '6', 'list', 6)])
    if args.cases:
        names = args.cases.split(',')
        if any(name not in [case[0] for case in cases] for name in names):
            raise RuntimeError('Unknown case')
        cases = [case for case in cases if case[0] in names]
    results = []

    def generate():
        cmd = (['node', str(lab.RUNTIME / 'hexo/node_modules/hexo/bin/hexo')] if args.reference_runtime == 'node' else ['bun', 'run', '--bun', '--no-install', 'hexo'])
        with (output / 'reference-generation.log').open('ab') as log:
            for action in ['clean', 'generate']:
                subprocess.run([*cmd, action, '--silent'], cwd=lab.RUNTIME / 'hexo', check=True, stdout=log, stderr=subprocess.STDOUT)

    try:
        if not args.baseline:
            target = lab.RUNTIME / 'hexo/source/pluginsSrc/infinitegrid.min.js'
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(REPO / 'node_modules/@egjs/infinitegrid/dist/infinitegrid.min.js', target)
        for name, layout, legacy, expected in cases:
            value = copy.deepcopy(original)
            value['index'].update({'index_layout': layout, 'post_layout': legacy})
            if name.startswith('no-cover'):
                value['cover']['index_enable'] = False
            if name.startswith('no-excerpt'):
                value['index']['index_post_content']['method'] = 'false'
            if name.startswith('no-top'):
                value.setdefault('image', {})['disable_top_img'] = True
            client.api(api, 'PUT', value)
            reference = copy.deepcopy(cfg)
            reference['index_layout'] = expected
            reference['index_post_content'] = {'method': False if name.startswith('no-excerpt') else 3, 'length': 500}
            if name.startswith('no-cover'):
                reference.setdefault('cover', {})['index_enable'] = False
            if name.startswith('no-top'):
                reference['disable_top_img'] = True
            if not args.baseline:
                reference.setdefault('CDN', {}).setdefault('option', {})['egjs_infinitegrid'] = '/pluginsSrc/infinitegrid.min.js'
            cfg_file.write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')
            generate()
            case_output = output / name
            case_output.mkdir()
            manifest = {**base, 'name': name, 'expectedLayout': expected, 'baseline': args.baseline,
                        'engines': engines, 'halo': lab.BASE['halo'], 'hexo': lab.BASE['hexo'],
                        'noCover': name.startswith('no-cover'), 'noExcerpt': name.startswith('no-excerpt') or legacy == 'tile' and not layout.isdigit(),
                        'noTopImage': name.startswith('no-top'),
                        'output': str(case_output)}
            manifest_file = case_output / 'manifest.json'
            manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
            result = subprocess.run(['bun', str(REPO / 'scripts/home-layouts/snapshot.mjs'), str(manifest_file)], cwd=REPO)
            report = json.loads((case_output / 'report.json').read_text())
            results.extend(report['observations'])
            print(name, 'passed' if result.returncode == 0 else 'failed', flush=True)
    finally:
        client.api(api, 'PUT', original)
        cfg_file.write_bytes(cfg_bytes)
        generate()
        if client.api(api) != original or cfg_file.read_bytes() != cfg_bytes:
            raise RuntimeError('Temporary configuration restoration failed')
    summary = {**base, 'observations': len(results), 'failed': sum(x['result'] != 'passed' for x in results),
               'cases': len(cases), 'configurationRestored': True, 'results': results}
    (output / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'results'}, ensure_ascii=False), flush=True)
    if summary['failed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
