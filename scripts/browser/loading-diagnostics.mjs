// Read-only transport diagnostics against an explicitly owned comparison lab.
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, RUNTIME, browserEnvironment, validateBaseUrl, validatePackage, responseFailure, sha256 } from './support.mjs';

export function loadingDiagnosticPlan() {
  const cases = [];
  for (const route of ['/', '/archives/preview-2/', '/about-preview/', '/archives/', '/tags/butterfly/']) {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const routed of [false, true]) {
      cases.push({ id: String(cases.length + 1).padStart(2, '0'), route, width, colorScheme, routed });
    }
  }
  return cases;
}

// Request identity matters: duplicate URLs can have separate unfinished requests.
export function loadingRequestLedger() {
  const requests = new Map();
  return {
    start(request) {
      const row = { id: requests.size + 1, url: request.url(), method: request.method(), type: request.resourceType(), startedAt: new Date().toISOString(), state: 'pending' };
      requests.set(request, row);
      return row;
    },
    get: request => requests.get(request),
    finish(request, failure) {
      const row = requests.get(request);
      if (row) Object.assign(row, { state: failure ? 'failed' : 'finished', finishedAt: new Date().toISOString(), ...(failure ? { error: failure } : {}) });
    },
    snapshot: () => structuredClone([...requests.values()]),
  };
}

export function loadingDiagnosticPassed(beforeClose, errors, navigationError) {
  return !navigationError && !errors.length && beforeClose.some(row => row.type === 'document' && row.status === 200 && row.state === 'finished') && beforeClose.every(row => row.state === 'finished' && row.status >= 200 && row.status < 400 && !row.responseError && !row.bodyError);
}

export async function boundedDiagnostic(operation, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' exceeded ' + timeoutMs + 'ms')), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}

export function completeLoadingDiagnostic(cases, installationRecordUnchanged) {
  return installationRecordUnchanged && cases.length === loadingDiagnosticPlan().length && cases.every(row => row.pass);
}

export async function ownedDiagnosticLab(directory, base) {
  const lab = path.resolve(directory);
  if (!lab.startsWith(path.join(REPO, '.runtime') + path.sep) || await realpath(lab) !== lab) throw new Error('Lab must be a nonsymlink directory inside this checkout .runtime');
  const marker = JSON.parse(await readFile(path.join(lab, 'lab.json')));
  validateBaseUrl(base, marker);
  const processRecord = JSON.parse(await readFile(path.join(lab, 'halo-process.json')));
  if (!Number.isSafeInteger(processRecord.pid) || processRecord.pid <= 0 || !processRecord.identity?.startsWith(lab + path.sep)) throw new Error('Invalid owned Halo process record');
  const command = execFileSync('ps', ['-p', String(processRecord.pid), '-o', 'command='], { encoding: 'utf8' });
  if (!command.includes(processRecord.identity) || !command.includes(`--server.port=${marker.ports.halo}`) || !command.includes('--server.address=127.0.0.1')) throw new Error('Owned loopback Halo process is not running');
  return lab;
}

async function run() {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--lab-runtime', '--theme-package', '--theme-source-sha', '--output'].includes(key) || !process.argv[i + 1] || options[key]) throw new Error('Use --lab-runtime PATH --theme-package ZIP --theme-source-sha FULL_SHA --output NEW_DIRECTORY with explicit BASE_URL');
    options[key] = process.argv[i + 1];
  }
  if (Object.keys(options).length !== 4) throw new Error('All four options are required');
  const lab = await ownedDiagnosticLab(options['--lab-runtime'], process.env.BASE_URL);
  const base = new URL(process.env.BASE_URL).origin;
  const installedFile = path.join(lab, 'installed-package.json');
  const installedBytes = await readFile(installedFile);
  const installed = JSON.parse(installedBytes);
  validatePackage(installed, options['--theme-source-sha'], sha256(await readFile(options['--theme-package'])));
  const output = path.resolve(options['--output']);
  const parent = path.dirname(output);
  if (!output.startsWith(lab + path.sep) || await realpath(parent) !== parent) throw new Error('Output must have a nonsymlink existing parent inside the owned lab');
  await mkdir(output); // Existing evidence is never overwritten.
  const write = (file, value) => writeFile(path.join(output, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const report = { schema: 1, startedAt: new Date().toISOString(), candidate: installed, candidateIdentityAttribution: 'Installed-record declaration matched to provided ZIP hash; active theme and installed-file completeness are not certified by this diagnostic.', scope: 'Fixed 40-case Firefox transport diagnostic; no retries, 20-second navigation timeout. Debug logging may affect scheduling. This does not replace acceptance or close historical failures.', timeoutMs: 20000, cases: [] };
  Object.assign(process.env, browserEnvironment());
  const pw = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
  for (const scenario of loadingDiagnosticPlan()) {
    const row = { ...scenario, startedAt: new Date().toISOString(), errors: [] };
    report.cases.push(row);
    const logFile = path.join(lab, 'halo.log');
    row.serverLogStart = (await stat(logFile)).size;
    let browser, context;
    const ledger = loadingRequestLedger(), bodyTasks = [];
    try {
      browser = await pw.firefox.launch({ headless: true, env: { ...browserEnvironment(), MOZ_LOG: 'timestamp,sync,nsHttp:5,nsSocketTransport:5', MOZ_LOG_FILE: path.join(output, row.id + '.moz.log') } });
      row.browserVersion = browser.version();
      context = await browser.newContext({ viewport: { width: row.width, height: row.width === 390 ? 844 : 1000 }, colorScheme: row.colorScheme, locale: 'zh-CN' });
      await context.addInitScript(color => localStorage.setItem('halo-butterfly-next.color-scheme', color), row.colorScheme);
      if (row.routed) await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const page = await context.newPage();
      page.on('request', request => ledger.start(request));
      page.on('response', response => {
        const entry = ledger.get(response.request());
        if (!entry) return;
        Object.assign(entry, { status: response.status(), responseAt: new Date().toISOString(), responseError: responseFailure(response.status(), response.headers()['content-type'] || '', entry.type) });
        bodyTasks.push(response.body().then(body => Object.assign(entry, { bodyBytes: body.length, bodySha256: sha256(body) })).catch(error => { entry.bodyError = String(error.message); }));
      });
      page.on('requestfinished', request => ledger.finish(request));
      page.on('requestfailed', request => ledger.finish(request, request.failure()?.errorText || 'request failed'));
      page.on('pageerror', error => row.errors.push(error.message));
      const response = await page.goto(base + row.route, { waitUntil: 'networkidle', timeout: 20000 });
      if (response.status() !== 200) throw new Error('Document HTTP ' + response.status());
    } catch (error) {
      row.error = String(error.stack || error);
    } finally {
      row.beforeClose = ledger.snapshot();
      row.pendingBeforeClose = row.beforeClose.filter(request => request.state === 'pending');
      row.pass = loadingDiagnosticPassed(row.beforeClose, row.errors, row.error);
      row.observationFinishedAt = new Date().toISOString();
      if (!row.pass) {
        try { row.sockets = execFileSync('netstat', ['-anv', '-p', 'tcp'], { encoding: 'utf8' }).split('\n').filter(line => line.includes('.' + new URL(base).port)); }
        catch (error) { row.socketSnapshotError = String(error.message); }
      }
      // Store pending state before closure changes it to aborted/finished.
      await write(row.id + '-before-close.json', row);
      for (const [label, handle] of [['context', context], ['browser', browser]]) {
        try { await boundedDiagnostic(() => handle?.close(), 5000, label + ' close'); }
        catch (error) { row.errors.push('cleanup: ' + error.message); if (label === 'browser') row.browserCleanupIncomplete = true; }
      }
      try { await boundedDiagnostic(() => Promise.all(bodyTasks), 5000, 'response body collection'); }
      catch (error) { row.errors.push(error.message); }
      row.requests = ledger.snapshot();
      row.pass = row.pass && loadingDiagnosticPassed(row.requests, row.errors, row.error);
      row.serverLogEnd = (await stat(logFile)).size;
      await writeFile(path.join(output, row.id + '.server.log'), (await readFile(logFile)).subarray(row.serverLogStart, row.serverLogEnd), { flag: 'wx' });
      row.finishedAt = new Date().toISOString();
      await write(row.id + '.json', row);
      console.log(row.id, row.route, row.width, row.colorScheme, row.routed ? 'route' : 'native', row.pass ? 'PASS' : 'FAIL');
    }
    if (row.browserCleanupIncomplete) break; // Preserve the incomplete batch instead of leaking additional browsers.
  }
  report.finishedAt = new Date().toISOString();
  report.total = report.cases.length;
  report.passed = report.cases.filter(row => row.pass).length;
  report.installationRecordUnchanged = (await readFile(installedFile)).equals(installedBytes);
  await write('report.json', report);
  console.log(JSON.stringify({ total: report.total, passed: report.passed, installationRecordUnchanged: report.installationRecordUnchanged }));
  if (!completeLoadingDiagnostic(report.cases, report.installationRecordUnchanged)) process.exitCode = 1;
}

if (import.meta.main) await run();
