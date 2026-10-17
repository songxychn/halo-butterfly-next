/** Local WebKit controls only: never contacts Halo or a user's browser. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {REPO, RUNTIME, browserEnvironment, sha256} from '../../browser/support.mjs';

const started = Date.now();
const worker = process.argv[2] === '--worker';
const output = path.resolve(process.argv[worker ? 3 : 2] || '');
const script = fileURLToPath(import.meta.url);
const runtime = path.join(REPO, '.runtime');
assert(output.startsWith(runtime + path.sep), 'Pass a new output directory inside this worktree .runtime');
const stamp = () => new Date().toISOString();
const writeJson = (name, value) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const bounded = async (action, ms, label) => {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(label + ' exceeded ' + ms + 'ms')), ms);
    })]);
  } finally { clearTimeout(timer); }
};

if (!worker) {
  await mkdir(path.dirname(output), {recursive: true});
  assert.equal(await realpath(path.dirname(output)), path.dirname(output), 'Output parent must not contain symlinks');
  await mkdir(output); // Existing evidence is never overwritten.
  await writeJson('owner.json', {owner: 'webkit-cancellation-controls', parentPid: process.pid, createdAt: stamp()});
  await writeFile(path.join(output, 'runner.mjs'), await readFile(script), {mode: 0o600});
  // A separate, exclusively owned process group bounds browser descendants too.
  // DEBUG=pw:protocol and its private log redirection are supplied by the caller.
  const child = spawn(process.execPath, [script, '--worker', output], {detached: true, stdio: 'inherit', env: process.env});
  const kill = signal => {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  let timedOut = false, forceTimer;
  const timer = setTimeout(() => {
    timedOut = true;
    kill('SIGTERM');
    forceTimer = setTimeout(() => kill('SIGKILL'), 1000);
  }, Math.max(1, 85000 - (Date.now() - started)));
  let outcome;
  try {
    outcome = await new Promise(resolve => {
      child.once('error', error => resolve({error: String(error)}));
      child.once('exit', (code, signal) => resolve({code, signal}));
    });
  } finally {
    clearTimeout(timer); clearTimeout(forceTimer);
    kill('SIGKILL'); // Also removes any owned descendants left after parent exit.
  }
  await writeJson('supervisor.json', {startedAt: new Date(started).toISOString(), finishedAt: stamp(), elapsedMs: Date.now() - started, wholeScriptLimitMs: 90000, terminationAtMs: 85000, timedOut, outcome, processGroup: child.pid, cleanup: 'Owned worker process group terminated after completion or timeout'});
  process.exitCode = timedOut || outcome.error || outcome.code !== 0 ? 1 : 0;
} else {
  assert.equal(await realpath(output), output);
  const owner = JSON.parse(await readFile(path.join(output, 'owner.json')));
  assert.equal(owner.owner, 'webkit-cancellation-controls');
  assert.equal(owner.parentPid, process.ppid, 'Worker must belong to its creating supervisor');
  Object.assign(process.env, browserEnvironment());
  const pw = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
  const report = {schema: 1, kind: 'local-webkit-request-classification-controls', startedAt: stamp(), runnerSha256: sha256(await readFile(script)), cases: [], serverEvents: [], limitations: [
    'Three fixed synthetic controls, not a Halo measurement or evidence that the earlier Halo cancellation has the same cause.',
    'Only a new loopback HTTP server and fresh headless WebKit are used. No external traffic, existing browser, fake requestfailed event or private browser API.',
    'The negative in-document control uses a real HTTP 404, not a synthetic abort. The navigation control requires a natural request failure before context closure.',
    'Public Playwright frame/page URLs are observations, not CDP loader identities. Caller may retain DEBUG=pw:protocol output separately with mode 0600.',
  ], limits: {actionMs: 15000, contextCloseMs: 10000, browserCloseMs: 10000, supervisorTerminationMs: 85000, wholeScriptMs: 90000}};
  const save = () => writeJson('report.json', report);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#367"/></svg>';
  const document = (id, image = '') => '<!doctype html><html><head><meta charset="utf-8"><title>' + id + '</title><link rel="icon" href="data:,"></head><body data-control="' + id + '">' + (image ? '<img id="image" src="' + image + '" onload="this.dataset.outcome=\'load\'" onerror="this.dataset.outcome=\'error\'">' : '') + '<a id="leave" href="/destination">Leave document</a></body></html>';
  let resolvePending;
  const pendingReceived = new Promise(resolve => { resolvePending = resolve; });
  const sockets = new Set();
  const server = createServer((request, response) => {
    const event = {path: request.url, method: request.method, receivedAt: stamp(), responseEnded: false};
    report.serverEvents.push(event);
    response.on('close', () => { event.closedAt = stamp(); event.closedBeforeEnd = !event.responseEnded; });
    response.on('error', error => { event.error = String(error); });
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (request.url === '/pending.svg') {
      // Leave the real HTTP response open; only the browser navigation may cancel
      // it before the case's assertions. Server cleanup happens after all cases.
      event.heldWithoutHeaders = true;
      resolvePending();
      return;
    }
    let body, type = 'text/html', status = 200;
    if (request.url === '/success') body = document('success', '/success.svg');
    else if (request.url === '/in-document-404') body = document('in-document-404', '/missing.svg');
    else if (request.url === '/leave-pending') body = document('leave-pending', '/pending.svg');
    else if (request.url === '/destination') body = document('destination');
    else if (request.url === '/success.svg') { body = svg; type = 'image/svg+xml'; }
    else { body = 'Not Found'; type = 'text/plain'; status = 404; }
    event.status = status;
    response.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'Connection': 'close'});
    event.responseEnded = true;
    response.end(body);
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  let browser;
  await save();
  try {
    await bounded(() => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 5000, 'Owned server startup');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    report.base = base;
    browser = await bounded(() => pw.webkit.launch({headless: true}), 10000, 'WebKit launch');
    report.browserVersion = browser.version();
    for (const id of ['success', 'in-document-404', 'leave-pending']) {
      let context, page;
      const row = {id, startedAt: stamp(), status: 'running', requests: [], documents: [], pageErrors: [], consoleErrors: [], timeline: []};
      report.cases.push(row); await save();
      try {
        context = await bounded(() => browser.newContext(), 10000, 'Context creation');
        await context.route('**/*', async route => {
          if (new URL(route.request().url()).origin === base) await route.continue();
          else { row.unexpectedExternalRequest = true; await route.abort(); }
        });
        page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
        const requests = new Map(); let serial = 0;
        let resolveTargetEnd;
        const targetEnd = new Promise(resolve => { resolveTargetEnd = resolve; });
        const imagePath = id === 'success' ? '/success.svg' : id === 'in-document-404' ? '/missing.svg' : '/pending.svg';
        page.on('request', request => {
          const item = {id: ++serial, url: request.url(), method: request.method(), resourceType: request.resourceType(), isMainDocument: request.isNavigationRequest() && request.frame() === page.mainFrame(), frameUrlAtStart: request.frame().url(), pageUrlAtStart: page.url(), startedAt: stamp(), state: 'pending'};
          requests.set(request, item); row.requests.push(item);
        });
        page.on('response', response => { const item = requests.get(response.request()); if (item) { item.httpStatus = response.status(); item.responseAt = stamp(); } });
        const end = (request, state) => {
          const item = requests.get(request); if (!item) return;
          Object.assign(item, {state, finishedAt: stamp(), pageUrlAtEnd: page.url()});
          if (state === 'failed') item.failure = request.failure()?.errorText;
          if (request.url() === base + imagePath) resolveTargetEnd(item);
        };
        page.on('requestfinished', request => end(request, 'finished'));
        page.on('requestfailed', request => end(request, 'failed'));
        page.on('framenavigated', frame => { if (frame === page.mainFrame()) row.documents.push({url: frame.url(), committedAt: stamp()}); });
        page.on('pageerror', error => row.pageErrors.push({message: error.message, stack: error.stack}));
        page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
        const response = await page.goto(base + '/' + id, {waitUntil: 'domcontentloaded'});
        assert.equal(response.status(), 200);
        if (id === 'leave-pending') {
          await bounded(() => pendingReceived, 15000, 'Pending image reached real server');
          const image = row.requests.find(item => item.url === base + imagePath);
          assert(image && image.state === 'pending' && image.httpStatus === undefined);
          row.beforeNavigation = {at: stamp(), documentUrl: page.url(), image: {...image}};
          row.timeline.push({event: 'native-link-click-start', at: stamp()});
          await page.locator('#leave').click({noWaitAfter: true});
          await page.waitForURL(base + '/destination', {waitUntil: 'domcontentloaded'});
          const result = await bounded(() => targetEnd, 15000, 'Natural image cancellation after navigation');
          assert.equal(result.state, 'failed'); assert.match(result.failure || '', /cancel|abort|interrupted/i);
          assert.equal(result.httpStatus, undefined);
          assert.equal(await page.locator('body').getAttribute('data-control'), 'destination');
          assert.equal(row.requests.filter(item => item.isMainDocument && item.url === base + '/destination' && item.httpStatus === 200).length, 1);
          row.classification = 'natural-old-document-image-cancellation-observed-before-context-close';
        } else {
          const result = await bounded(() => targetEnd, 15000, 'In-document image completion');
          await page.waitForFunction(() => !!document.querySelector('#image').dataset.outcome);
          row.image = await page.locator('#image').evaluate(image => ({complete: image.complete, naturalWidth: image.naturalWidth, outcome: image.dataset.outcome}));
          assert.equal(page.url(), base + '/' + id);
          assert.equal(result.state, 'finished'); assert.equal(result.httpStatus, id === 'success' ? 200 : 404);
          assert.equal(row.image.outcome, id === 'success' ? 'load' : 'error');
          assert.equal(row.image.complete, true); assert.equal(row.image.naturalWidth > 0, id === 'success');
          row.classification = id === 'success' ? 'successful-in-document-image' : 'genuine-in-document-http-404-image-error';
        }
        assert.deepEqual(row.pageErrors, []); assert(!row.unexpectedExternalRequest);
        assert(row.consoleErrors.every(text => id === 'in-document-404' && /404/.test(text)), 'Unexpected console error');
        row.assertionsCompletedAt = stamp(); row.status = 'passed-control';
      } catch (error) { row.status = 'failed-control'; row.error = String(error.stack || error); }
      finally {
        row.requestsBeforeClose = row.requests.map(item => ({...item}));
        row.contextCloseStartedAt = stamp(); await save();
        if (context) await bounded(() => context.close(), 10000, 'Context close').catch(error => { row.status = 'failed-control'; row.closeError = String(error); });
        row.contextCloseFinishedAt = stamp();
        // A cancellation produced only by this close cannot pass the earlier gate.
        if (row.pageErrors.length || row.unexpectedExternalRequest) row.status = 'failed-control';
        await save();
      }
    }
  } catch (error) { report.error = String(error.stack || error); }
  finally {
    if (browser) await bounded(() => browser.close(), 10000, 'Browser close').catch(error => { report.closeError = String(error); });
    for (const socket of sockets) socket.destroy();
    await bounded(() => new Promise(resolve => server.close(resolve)), 1000, 'Server close').catch(error => { report.serverCloseError = String(error); });
    for (const row of report.cases) {
      const expectedNetwork = request => {
        const pathname = new URL(request.url).pathname;
        if (row.id === 'in-document-404' && pathname === '/missing.svg') return request.state === 'finished' && request.httpStatus === 404;
        if (row.id === 'leave-pending' && pathname === '/pending.svg') return request.state === 'failed' && /cancel|abort|interrupted/i.test(request.failure || '') && request.httpStatus === undefined;
        return request.state === 'finished' && request.httpStatus === 200;
      };
      row.finalErrors = {page: row.pageErrors.length, console: row.consoleErrors.filter(text => !(row.id === 'in-document-404' && /404/.test(text))).length, network: row.requests.filter(request => !expectedNetwork(request)).length};
      if (Object.values(row.finalErrors).some(Boolean) && row.status === 'passed-control') {
        row.status = 'failed-control'; row.error = 'Final control error gate failed: ' + JSON.stringify(row.finalErrors);
      }
    }
    report.finishedAt = stamp();
    report.status = report.cases.length === 3 && report.cases.every(row => row.status === 'passed-control') && !report.error && !report.closeError && !report.serverCloseError ? 'passed-local-controls-only' : 'failed-local-controls';
    await save(); console.log(JSON.stringify({output, status: report.status}));
    process.exitCode = report.status === 'passed-local-controls-only' ? 0 : 1;
  }
}
