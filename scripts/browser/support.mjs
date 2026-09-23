import { readFile, mkdir, readdir, writeFile, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const FIXTURE = path.join(REPO, 'fixtures/browser');
export const RUNTIME = path.join(REPO, '.runtime/browser-matrix');
export const ENGINES = ['chromium', 'firefox', 'webkit'];
export const COUNTER_PATH = '/apis/api.halo.run/v1alpha1/trackers/counter';
export const ROUTES = ['/', '/page/2/', '/archives/', '/categories/', '/categories/development/', '/tags/', '/tags/butterfly/', '/archives/preview-1/', '/archives/preview-2/', '/about-preview/'];
export const sha256 = value => createHash('sha256').update(value).digest('hex');
// Browser response APIs decode textual bodies and Chromium drops a UTF-8 BOM.
// Keep raw hashes in evidence, but compare only this known encoding difference.
export function comparableAsset(value, resourceType) {
  return ['stylesheet', 'script'].includes(resourceType) && value.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? value.subarray(3) : value;
}
export const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
export const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export async function writeProgress(directory, count, value) {
  const file = path.join(directory, `progress-${String(count).padStart(3, '0')}-${randomUUID()}.json`);
  await writeJson(file, value);
  return file;
}

export function validateBaseUrl(value, identity) {
  if (!value) throw new Error('BASE_URL is required; no implicit target is allowed');
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BASE_URL must be an explicit http://127.0.0.1:<port> isolated Halo origin');
  }
  if (identity?.owner !== 'halo-butterfly-next-comparison' || identity.schema !== 1 || identity.ports?.halo !== Number(url.port)) {
    throw new Error('BASE_URL does not match the provided comparison lab ownership marker');
  }
  return url.origin;
}

export function validatePackage(installed, sourceSha, digest) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha || '')) throw new Error('A full theme source SHA is required');
  if (installed?.sourceCommit !== sourceSha || installed.sha256 !== digest) throw new Error('Declared theme source/package does not match the lab installation record');
}

export async function ownRuntime(directory = RUNTIME) {
  await mkdir(directory, { recursive: true });
  if (await realpath(directory) !== path.resolve(directory)) throw new Error('Browser runtime must not be a symlink');
  const marker = path.join(directory, 'owner.json');
  const expected = { owner: 'halo-butterfly-next-browser-matrix', schema: 1 };
  try {
    const found = await readJson(marker);
    if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error('Browser runtime has a different owner');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if ((await readdir(directory)).length) throw new Error('Refusing to claim a nonempty browser runtime');
    await writeJson(marker, expected);
  }
  for (const name of ['deps', 'browsers', 'tmp', 'runs', 'pnpm-store']) {
    const target = path.join(directory, name);
    await mkdir(target, { recursive: true });
    if (await realpath(target) !== target) throw new Error('Browser runtime children must not be symlinks');
  }
  return directory;
}

export function browserEnvironment(runtime = RUNTIME) {
  if (process.env.SELENIUM_REMOTE_URL) throw new Error('Remote browser connection environment is not allowed');
  const browsers = path.join(runtime, 'browsers');
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH) !== browsers) {
    throw new Error('PLAYWRIGHT_BROWSERS_PATH must remain within this task runtime');
  }
  return { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers, PLAYWRIGHT_SKIP_BROWSER_GC: '1', TMPDIR: path.join(runtime, 'tmp'), TMP: path.join(runtime, 'tmp'), TEMP: path.join(runtime, 'tmp') };
}

export function responseFailure(status, contentType, resourceType) {
  if (status < 200 || status >= 400) return `HTTP ${status}`;
  if (['stylesheet', 'script', 'image', 'font', 'media'].includes(resourceType) && /^(text\/html|application\/xhtml\+xml)(;|$)/i.test(contentType)) return 'Asset returned HTML';
  return null;
}

export function requestPolicy(value, method, base) {
  const url = new URL(value);
  if (url.origin !== base || url.username || url.password) return 'blocked';
  if (['GET', 'HEAD'].includes(method)) return 'read';
  // Exact public endpoint only: query strings, suffixes, encoded lookalikes,
  // console/auth APIs and every other write remain blocked.
  return method === 'POST' && value === base + COUNTER_PATH ? 'visit-counter' : 'blocked';
}

export function boundedError(error, limit = 1800) {
  const value = String(error?.message || error);
  return value.length <= limit * 2 ? value : value.slice(0, limit) + '\n[bounded diagnostic: middle omitted]\n' + value.slice(-limit);
}

export async function finishPage(result, pending, closeContext, timeoutMs = 5000, requestLedger) {
  const bounded = async (operation, label) => {
    let timer;
    const controller = new AbortController();
    try {
      await Promise.race([Promise.resolve().then(() => operation(controller.signal)), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' exceeded ' + timeoutMs + 'ms')), timeoutMs);
      })]);
    } catch (error) { result.failures.push(label + ': ' + boundedError(error)); }
    finally { clearTimeout(timer); controller.abort(); }
  };
  const unfinished = () => {
    try { return requestLedger?.pendingRequests() || []; }
    catch (error) { result.failures.push('Request completion snapshot: ' + boundedError(error)); return []; }
  };
  const drain = async (signal, requireCompletion = false) => {
    // Responses can arrive while an earlier body is draining. A single snapshot
    // of Promise.all(pending) cannot certify those later response tasks.
    while (!signal.aborted) {
      const count = pending.length;
      await Promise.all(pending);
      if (signal.aborted) return;
      if (pending.length !== count) continue;
      if (!requireCompletion || !unfinished().length) return;
      await new Promise(resolve => {
        const stop = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); resolve(); };
        const timer = setTimeout(stop, 10);
        signal.addEventListener('abort', stop, { once: true });
      });
    }
  };
  await bounded(signal => drain(signal, true), 'Resource completion before close');
  // Preserve pre-close evidence. Context closure may silently discard a request,
  // or emit a late finished/failed event; neither can certify its prior completion.
  if (requestLedger) {
    result.pendingRequestsBeforeClose = unfinished();
    if (result.pendingRequestsBeforeClose.length) result.failures.push('Unfinished resource requests before context close');
  }
  // Closing can emit requestfailed and complete response-body tasks. Drain
  // those events before deriving the status that is written to evidence.
  await bounded(closeContext, 'Context close');
  await bounded(signal => drain(signal), 'Response body drain after close');
  // Only the live request ledger can provide identity-based exemptions. Raw
  // report classifications never grant an exemption, including at cleanup.
  const exemptions = requestLedger?.exemptions() || {};
  if (result.resources.some(item => item.captureError && !exemptions.resourceCaptureErrors?.has(item))) result.failures.push('Resource response body capture failed');
  if (result.jsErrors.length) result.failures.push('Uncaught page JavaScript errors');
  if (result.blockedRequests.length || result.requestFailures.some(item => !exemptions.requestFailures?.has(item))) result.failures.push('Blocked or failed requests');
  if (result.resources.some(item => item.failure)) result.failures.push('Invalid resource response or package asset mismatch');
  result.status = result.failures.length ? 'failed' : 'passed';
  return result;
}
