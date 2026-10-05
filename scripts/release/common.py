"""Shared strict release identity and ordering checks (standard library only)."""
import hashlib, json, re, subprocess
from pathlib import Path
REPO='songxychn/halo-butterfly-next'
PATTERN=r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?'
def version_key(tag):
    m=re.fullmatch(PATTERN,tag)
    if not m: raise ValueError('Expected vX.Y.Z or vX.Y.Z-alpha.N/beta.N/rc.N')
    a,b,c,stage,n=m.groups()
    return (int(a),int(b),int(c),{'alpha':0,'beta':1,'rc':2,None:3}[stage],int(n or 0))
def newer(candidate,current): return version_key(candidate)>version_key(current)
def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def run(*args): return subprocess.check_output(args,text=True).strip()
def gh(path): return json.loads(run('gh','api','repos/'+REPO+'/'+path))
def eligible_releases():
    # Explicit pagination; GitHub /latest omits prereleases.
    result=[]
    for page in range(1,101):
        rows=gh('releases?per_page=100&page='+str(page))
        for r in rows:
            if r['draft']: continue
            try: version_key(r['tag_name'])
            except ValueError: continue
            result.append(r)
        if len(rows)<100: return result
    raise RuntimeError('Release pagination exceeded bound')
def latest_tag():
    rows=eligible_releases()
    return max((r['tag_name'] for r in rows),key=version_key) if rows else None

def validate_evidence(evidence,tag,source,package_sha):
    version_key(tag)
    if evidence.get('tag')!=tag or evidence.get('themeSha256')!=package_sha: raise ValueError('Release evidence identity mismatch')
    checked=evidence.get('sourceSha','')
    if not re.fullmatch('[a-f0-9]{40}',checked): raise ValueError('Missing reviewed source SHA')
    subprocess.run(['git','merge-base','--is-ancestor',checked,source],check=True)
    if not evidence.get('reviewer') or evidence.get('decision')!='approved': raise ValueError('Missing independent release approval')
    for gate in ['realHalo','installUpgradeRollback','resourcesAndLicenses','sourceRebuild']:
        if evidence.get('gates',{}).get(gate)!='passed': raise ValueError('Release gate incomplete: '+gate)
    if not isinstance(evidence.get('knownLimitations'),list): raise ValueError('Known limitations must be explicit')
    for record in evidence.get('evidence',[]):
        path=Path(record['path'])
        if path.is_absolute() or '..' in path.parts or not path.is_file() or digest(path)!=record['sha256']: raise ValueError('Evidence file mismatch')
    if not evidence.get('evidence'): raise ValueError('Missing acceptance evidence files')
    allowed={'releases/'+tag+'.json','releases/'+tag+'.md'}
    allowed.update(r['path'] for r in evidence['evidence'] if r['path'].startswith('docs/validation/'))
    changed=set(run('git','diff','--name-only',checked,source).splitlines())
    if changed-allowed: raise ValueError('Product or workflow changed after reviewed source SHA')

def verify_asset_directory(output, asset_names, tag):
    version_key(tag)
    package='halo-butterfly-next-'+tag[1:]+'.zip'
    source_archive='halo-butterfly-next-'+tag[1:]+'-source.tar.gz'
    required={package,source_archive,'release-validation.json'}
    expected_names=required|{'SHA256SUMS'}
    if len(asset_names)!=len(set(asset_names)) or set(asset_names)!=expected_names or {p.name for p in output.iterdir()}!=expected_names: raise ValueError('Unexpected release asset inventory')
    sums={}
    for line in (output/'SHA256SUMS').read_text().splitlines():
        sha,name=line.split('  ',1)
        if not re.fullmatch('[a-f0-9]{64}',sha) or name not in required or name in sums or digest(output/name)!=sha: raise ValueError('Published checksum mismatch')
        sums[name]=sha
    if set(sums)!=required: raise ValueError('Incomplete checksum manifest')
    record=json.loads((output/'release-validation.json').read_text())
    if record['tag']!=tag or record['themeSha256']!=digest(output/package) or record['sourceArchiveSha256']!=digest(output/source_archive): raise ValueError('Release identity mismatch')
    return record
