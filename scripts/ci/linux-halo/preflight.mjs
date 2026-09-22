import { createRequire } from 'node:module';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RUNTIME, ownRuntime, browserEnvironment, boundedError, sha256 } from '../../browser/support.mjs';

// Exactly the matrix's bundled Chromium launch profile; no system/user browser.
const report = { engine: 'chromium', status: 'incomplete', platform: { type: os.type(), release: os.release(), arch: os.arch() } };
let browser;
try {
  await ownRuntime();
  Object.assign(process.env, browserEnvironment());
  const require = createRequire(await realpath(path.join(RUNTIME, 'deps/node_modules/playwright/package.json')));
  const { chromium } = require('playwright');
  const executable = await realpath(chromium.executablePath());
  if (!executable.startsWith(path.join(RUNTIME, 'browsers') + path.sep)) throw new Error('Browser executable escaped task runtime');
  report.executableSha256 = sha256(await readFile(executable));
  browser = await chromium.launch({ headless: true, channel: 'chromium', timeout: 30000, env: browserEnvironment() });
  report.version = browser.version();
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = boundedError(error, 6000);
} finally {
  try { if (browser) await browser.close(); }
  catch (error) { report.status = 'failed'; report.closeError = boundedError(error); }
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log('Linux Chromium launch preflight ' + JSON.stringify(report));
}
process.exitCode = report.status === 'passed' ? 0 : 1;
