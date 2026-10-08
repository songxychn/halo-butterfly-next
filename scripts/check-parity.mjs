import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ROOT, renderMatrix, statusLabels } from './parity-render.mjs';
import { inspectUpstream, requiredEntries, entryId, sha256, UPSTREAM_COMMIT, UPSTREAM_VERSION } from './parity-inventory.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const digest = value => /^[a-f0-9]{64}$/.test(value ?? '');
const timestamp = value => nonempty(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const safePath = value => nonempty(value) && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..');
export const contractScenarioIds = text => new Set([...text.matchAll(/^\| ([A-Z][A-Z0-9]*-\d{2}) \|/gm)].map(match => match[1]));

export function checkMatrix(matrix, inventory) {
  const errors = [];
  const fail = message => errors.push(message);
  if (matrix.schemaVersion !== 1 || inventory.schemaVersion !== 1) fail('Unsupported schema version');
  for (const document of [matrix, inventory]) {
    if (document.upstream?.commit !== UPSTREAM_COMMIT || document.upstream?.version !== UPSTREAM_VERSION) fail('Fixed upstream baseline changed');
  }
  if (!sha(matrix.haloBaseline)) fail('Halo baseline must be an exact commit');
  const ids = new Set();
  const sources = new Map(inventory.files.map(file => [file.file, file]));
  const byId = new Map();
  for (const item of matrix.items) {
    if (!nonempty(item.id) || ids.has(item.id)) fail(`Duplicate or missing ID: ${item.id}`);
    ids.add(item.id);
    byId.set(item.id, item);
    if (!nonempty(item.title) || !nonempty(item.key) || !nonempty(item.kind)) fail(`Missing identity: ${item.id}`);
    if (!(item.status in statusLabels)) fail(`Invalid status: ${item.id} (${item.status})`);
    if (item.status === 'blocked' && (!nonempty(item.blocker?.phase) || !nonempty(item.blocker?.reason) || !nonempty(item.blocker?.nextAction))) fail(`Blocked without next action: ${item.id}`);
    if (item.status === 'not-applicable') {
      const decision = item.decision;
      if (!nonempty(decision?.id) || !nonempty(decision?.option) || !nonempty(decision?.reason) || !nonempty(decision?.replacement) || !timestamp(decision?.date) || !/^https:\/\/github\.com\/songxychn\/halo-butterfly-next\/issues\/\d+$/.test(decision?.issue ?? '')) {
        fail(`Not-applicable without decision: ${item.id}`);
      }
    }
    if (!Array.isArray(item.sources) || !item.sources.length) fail(`Missing upstream source: ${item.id}`);
    for (const source of item.sources ?? []) if (!sources.has(source.file) || !Number.isInteger(source.line) || source.line < 1 || source.line > sources.get(source.file).lines) fail(`Invalid upstream reference: ${item.id}`);
    if (!nonempty(item.halo?.strategy) || !nonempty(item.halo?.finding) || !Array.isArray(item.halo?.code) || !Array.isArray(item.halo?.settings)) fail(`Missing Halo adaptation: ${item.id}`);
    if (!Array.isArray(item.dependencies)) fail(`Missing dependencies: ${item.id}`);
    for (const dependency of item.dependencies ?? []) if (!matrix.dependencies[dependency]) fail(`Unknown dependency ${dependency}: ${item.id}`);
    if (!matrix.acceptanceProfiles[item.acceptance?.profile] || !Array.isArray(item.acceptance?.cases) || !item.acceptance.cases.length || !item.acceptance.cases.every(nonempty)) fail(`Missing acceptance scenario: ${item.id}`);
    if (!Array.isArray(item.acceptance?.contractScenarios) || !item.acceptance.contractScenarios.length) fail(`Missing contract scenarios: ${item.id}`);
    if (!Array.isArray(item.tracking?.issues) || !Array.isArray(item.tracking?.pullRequests)) fail(`Missing issue/PR tracking: ${item.id}`);
    if (!Array.isArray(item.evidence)) fail(`Missing evidence array: ${item.id}`);
    if (item.status === 'verified') {
      const evidence = item.evidence ?? [];
      if (!evidence.some(e => e.kind === 'runtime') || !evidence.some(e => e.kind === 'review') || !evidence.some(e => e.kind === 'ci')) fail(`Verified without runtime/review/CI: ${item.id}`);
      if (!sha(item.verifiedCommit) || evidence.some(e => e.commit !== item.verifiedCommit)) fail(`Verified evidence commit mismatch: ${item.id}`);
      if (evidence.some(e => !safePath(e.path) || !timestamp(e.date) || !nonempty(e.actor) || !digest(e.sha256))) fail(`Incomplete verified evidence: ${item.id}`);
      if (evidence.some(e => e.outcome !== 'passed')) fail(`Verified evidence did not pass: ${item.id}`);
      if (!nonempty(item.author) || evidence.filter(e => e.kind === 'review').some(e => e.actor === item.author)) fail(`Review must be independent: ${item.id}`);
    }
  }
  for (const required of requiredEntries(inventory)) {
    const id = entryId(required.kind, required.key);
    const item = byId.get(id);
    if (!item) fail(`Missing upstream coverage: ${id}`);
    else {
      if (item.kind !== required.kind || item.key !== required.key) fail(`Coverage identity mismatch: ${id}`);
      if (!item.sources.some(source => source.file === required.source.file && source.line === required.source.line && (required.kind !== 'config' || source.key === required.key))) fail(`Wrong upstream source: ${id}`);
    }
  }
  for (const [key, profile] of Object.entries(matrix.acceptanceProfiles)) {
    if (!Array.isArray(profile.scenarios) || !profile.scenarios.length || !profile.scenarios.every(nonempty)) fail(`Empty acceptance profile: ${key}`);
  }
  return errors;
}

export function checkRequiredScenarios(matrix, required) {
  const errors = [];
  if (required.schemaVersion !== 1 || required.upstreamCommit !== UPSTREAM_COMMIT) errors.push('Manual scenario baseline changed');
  const ids = new Set();
  for (const entry of required.items) {
    if (ids.has(entry.id)) errors.push(`Duplicate required scenario: ${entry.id}`);
    ids.add(entry.id);
    const item = matrix.items.find(item => item.id === entry.id);
    if (!item || item.kind !== entry.kind || item.key !== entry.key) errors.push(`Missing required scenario: ${entry.id}`);
    else if (!entry.sources.every(source => item.sources.some(actual => actual.file === source.file && actual.line === source.line))) errors.push(`Wrong required scenario source: ${entry.id}`);
  }
  return errors;
}

export function checkEvidenceManifest(manifest, evidence, item) {
  const errors = [];
  const fail = message => errors.push(`${item.id}: ${message}`);
  if (manifest.kind !== evidence.kind || manifest.sourceSha !== item.verifiedCommit || manifest.upstreamSha !== UPSTREAM_COMMIT || manifest.result !== 'passed' || manifest.actor !== evidence.actor || manifest.testedAt !== evidence.date) fail('Evidence manifest identity/result mismatch');
  if (!manifest.matrixIds?.includes(item.id)) fail('Evidence manifest does not cover matrix ID');
  if (!Array.isArray(manifest.commandsAndReports) || !manifest.commandsAndReports.length || !manifest.commandsAndReports.every(nonempty)) fail('Evidence manifest lacks commands/reports');
  if (!Array.isArray(manifest.limitations)) fail('Evidence manifest lacks limitations');
  if (evidence.kind === 'runtime') {
    if (!digest(manifest.artifactSha256) || !sha(manifest.fixtureSha) || manifest.haloVersion !== '2.26.1' || !safePath(manifest.runtimeManifest)) fail('Runtime evidence lacks exact package/fixture/platform manifest');
    if (!item.acceptance.contractScenarios.every(id => manifest.scenarioIds?.includes(id))) fail('Runtime evidence does not cover required contract scenarios');
  }
  if (evidence.kind === 'review' && (manifest.actor === item.author || manifest.reviewedSha !== item.verifiedCommit)) fail('Independent review mismatch');
  if (evidence.kind === 'ci' && (manifest.headSha !== item.verifiedCommit || manifest.conclusion !== 'success' || !/^https:\/\/github\.com\/songxychn\/halo-butterfly-next\/actions\/runs\/\d+$/.test(manifest.runUrl ?? ''))) fail('CI evidence lacks successful exact-head run');
  return errors;
}

function settingNames(settings) {
  const result = new Set();
  function visit(nodes, prefix) {
    for (const node of nodes ?? []) {
      const name = node.name ? `${prefix}.${node.name}` : prefix;
      if (node.name) result.add(name);
      if (node.children) visit(node.children, name);
    }
  }
  for (const form of settings.spec.forms) visit(form.formSchema, form.group);
  return result;
}

export async function checkParity({ root = ROOT, upstream } = {}) {
  const matrix = JSON.parse(await readFile(path.join(root, 'docs/parity/matrix.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(path.join(root, 'docs/parity/upstream-5.7.0.json'), 'utf8'));
  const required = JSON.parse(await readFile(path.join(root, 'docs/parity/required-scenarios.json'), 'utf8'));
  const errors = [...checkMatrix(matrix, inventory), ...checkRequiredScenarios(matrix, required)];
  if (upstream) {
    const actual = await inspectUpstream(upstream);
    if (JSON.stringify(actual) !== JSON.stringify(inventory)) errors.push('Pinned upstream inventory differs from source checkout');
    for (const item of matrix.items) {
      for (const source of item.sources.filter(source => source.symbol)) {
        const content = await readFile(path.join(upstream, source.file), 'utf8');
        if (!content.split('\n')[source.line - 1]?.includes(source.symbol)) errors.push(`Upstream symbol not found at recorded line: ${item.id}`);
      }
    }
  }
  const settings = settingNames(parse(await readFile(path.join(root, 'settings.yaml'), 'utf8')));
  const contract = await readFile(path.join(root, 'docs/RELEASE-ACCEPTANCE.md'), 'utf8');
  const contractIds = contractScenarioIds(contract);
  const codeReferences = new Set();
  for (const item of matrix.items) {
    for (const id of item.acceptance.contractScenarios ?? []) if (!contractIds.has(id)) errors.push(`Unknown contract scenario: ${item.id} -> ${id}`);
    for (const key of item.halo.settings) if (!settings.has(key)) errors.push(`Halo setting does not exist: ${item.id} -> ${key}`);
    for (const file of item.halo.code) codeReferences.add(file);
    if (item.status === 'verified') {
      for (const evidence of item.evidence) {
        if (!safePath(evidence.path)) continue;
        try {
          const content = await readFile(path.join(root, evidence.path), 'utf8');
          if (sha256(content) !== evidence.sha256) errors.push(`Evidence digest mismatch: ${item.id} -> ${evidence.path}`);
          const manifest = JSON.parse(content);
          errors.push(...checkEvidenceManifest(manifest, evidence, item));
          if (evidence.kind === 'runtime' && safePath(manifest.runtimeManifest)) await access(path.join(root, manifest.runtimeManifest));
        } catch (error) { errors.push(`Unreadable evidence: ${item.id} -> ${evidence.path}: ${error.message}`); }
      }
    }
  }
  for (const file of codeReferences) {
    if (path.isAbsolute(file) || file.includes('..')) errors.push(`Unsafe code path: ${file}`);
    else try { await access(path.join(root, file)); } catch { errors.push(`Halo code file does not exist: ${file}`); }
  }
  const rendered = await readFile(path.join(root, 'docs/parity/MATRIX.md'), 'utf8');
  if (rendered !== renderMatrix(matrix)) errors.push('MATRIX.md is stale; run bun scripts/parity-render.mjs');
  if (errors.length) throw new Error(errors.join('\n'));
  return { total: matrix.items.length, required: requiredEntries(inventory).length + required.items.length, yamlLeaves: inventory.configuration.length,
    verified: matrix.items.filter(item => item.status === 'verified').length,
    notApplicable: matrix.items.filter(item => item.status === 'not-applicable').length, sourceVerified: Boolean(upstream) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--upstream')) throw new Error('Usage: bun scripts/check-parity.mjs [--upstream /path/to/hexo-theme-butterfly]');
  console.log(JSON.stringify(await checkParity({ upstream: args[1] }), null, 2));
}
