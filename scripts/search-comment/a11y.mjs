import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import {
  browserEnvironment,
  REPO,
  RUNTIME,
  validateBaseUrl,
} from "../browser/support.mjs";
const [runtime, output] = process.argv.slice(2);
assert(runtime && output, "Pass owned lab runtime and output directory");
const marker = JSON.parse(
  await readFile(path.join(runtime, "lab.json"), "utf8"),
);
const base = validateBaseUrl(process.env.BASE_URL, marker);
const installed = JSON.parse(
  await readFile(path.join(runtime, "installed-package.json"), "utf8"),
);
const axePath = path.join(
  REPO,
  ".runtime/plugin-a11y/node_modules/axe-core/axe.min.js",
);
const version = JSON.parse(
  await readFile(
    path.join(REPO, ".runtime/plugin-a11y/node_modules/axe-core/package.json"),
    "utf8",
  ),
).version;
assert.equal(version, "4.12.1");
Object.assign(process.env, browserEnvironment());
const { chromium } = await import(
  pathToFileURL(path.join(RUNTIME, "deps/node_modules/playwright/index.mjs"))
);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  theme: installed,
  runnerSha: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  axe: version,
  browser: browser.version(),
  rows: [],
  scope:
    "Comment region only; headless desktop/mobile viewport, not complete a11y acceptance",
};
try {
  for (const width of [1440, 390])
    for (const mode of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        colorScheme: mode,
        locale: "zh-CN",
        storageState: {
          cookies: [],
          origins: [
            {
              origin: base,
              localStorage: [
                { name: "halo-butterfly-next.color-scheme", value: mode },
              ],
            },
          ],
        },
      });
      await context.route("**/*", (r) =>
        new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(base + "/archives/preview-1/", {
        waitUntil: "domcontentloaded",
      });
      await page.locator("#post-comment").scrollIntoViewIfNeeded();
      await page.locator("[contenteditable]").first().waitFor();
      await page.addScriptTag({ path: axePath });
      const button = page.locator("comment-form .form-submit");
      await button.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (expected) => document.documentElement.dataset.colorScheme === expected,
        mode,
      );
      const actualMode = await page.getAttribute("html", "data-color-scheme");
      const row = { width, mode, actualMode, states: [] };
      for (const state of ["normal", "hover", "focus"]) {
        if (state === "hover") await button.hover();
        if (state === "focus") {
          await page.mouse.move(0, 0);
          await button.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          assert(await button.evaluate((e) => e.matches(":focus-visible")));
        }
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) =>
                Number.isFinite(a.effect?.getComputedTiming().endTime),
              )
              .map((a) => a.finished.catch(() => {})),
          ),
        );
        const audit = await page.evaluate(() =>
          window.axe.run(document.querySelector("#post-comment"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          }),
        );
        const colors = await button.evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            color: s.color,
            background: s.backgroundColor,
            opacity: s.opacity,
            outline: s.outlineColor,
            shadow: s.boxShadow,
            focusVisible: e.matches(":focus-visible"),
          };
        });
        row.states.push({
          state,
          colors,
          violations: audit.violations,
          incomplete: audit.incomplete,
        });
      }
      await page.screenshot({
        path: path.join(output, `comment-${width}-${mode}.png`),
      });
      await page.evaluate(() =>
        document.body.style.setProperty("--halo-cw-primary-1-color", "#800080"),
      );
      await page.mouse.move(0, 0);
      row.customInherited = await button.evaluate(
        (e) => getComputedStyle(e).backgroundColor,
      );
      assert.equal(row.customInherited, "rgb(128, 0, 128)");
      report.rows.push(row);
      console.log(
        width,
        mode,
        row.states.map((s) => ({
          state: s.state,
          violations: s.violations.map((v) => v.id),
          incomplete: s.incomplete.map((v) => v.id),
          colors: s.colors,
        })),
      );
      await context.close();
    }
} finally {
  await browser.close();
  await writeFile(
    path.join(output, "a11y.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
process.exitCode = report.rows.some((r) =>
  r.states.some((s) => s.violations.length),
)
  ? 1
  : 0;
