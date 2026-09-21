import JSZip from "jszip";
import { parse, stringify } from "yaml";
/** Destructive plugin lifecycle checks ONLY on an explicitly owned synthetic lab. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, stat, realpath } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  REPO,
  RUNTIME,
  browserEnvironment,
  validateBaseUrl,
  validatePackage,
  sha256,
} from "../browser/support.mjs";
const options = Object.fromEntries(
  Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) =>
    process.argv.slice(2 + i * 2, 4 + i * 2),
  ),
);
for (const key of [
  "--lab-runtime",
  "--theme-package",
  "--theme-source-sha",
  "--output",
])
  assert(options[key], key + " required");
assert.equal(options["--allow-synthetic-writes"], "yes");
const runtime = await realpath(options["--lab-runtime"]);
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const base = validateBaseUrl(
  process.env.BASE_URL,
  await read(path.join(runtime, "lab.json")),
);
await read(path.join(runtime, "seed.json"));
const installed = await read(path.join(runtime, "installed-package.json"));
validatePackage(
  installed,
  options["--theme-source-sha"],
  sha256(await readFile(options["--theme-package"])),
);
const authPath = path.join(runtime, "plugin-auth.private.json");
assert.equal((await stat(authPath)).mode & 0o077, 0);
const auth = await read(authPath),
  lock = await read(path.join(REPO, "fixtures/search-comment/versions.json"));
const output = path.resolve(options["--output"]);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const report = {
  schema: 1,
  runnerFileSha256: sha256(await readFile(new URL(import.meta.url))),
  trackedWorkingTreeClean: !execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8" },
  ).trim(),
  runnerSha: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  theme: installed,
  startedAt: new Date().toISOString(),
  checks: [],
  restoreErrors: [],
  contractAcceptance: false,
  limitations: [
    "Version rejection uses an isolated JAR manifest contract fixture, NOT a real old plugin release.",
    "Headless Chromium only; no real mobile/Safari/screen reader claims.",
    "Official search focus issue #313 remains open; no upstream code changed.",
  ],
};
const save = () =>
  writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
Object.assign(process.env, browserEnvironment());
const { chromium } = await import(
  pathToFileURL(path.join(RUNTIME, "deps/node_modules/playwright/index.mjs"))
);
const browser = await chromium.launch({ channel: "chromium", headless: true });
report.browser = browser.version();
const admin = await browser.newContext({
  storageState: { cookies: auth.cookies, origins: [] },
});
const resource = "/apis/plugin.halo.run/v1alpha1/plugins",
  consolePath = "/apis/api.console.halo.run/v1alpha1/plugins";
const configPath = "/api/v1alpha1/configmaps/halo-butterfly-next-configMap";
const themePath = "/apis/api.console.halo.run/v1alpha1/themes/";
async function api(p, method = "GET", data) {
  assert(p.startsWith("/"));
  const r = await admin.request.fetch(base + p, {
    method,
    data,
    headers: { "X-CSRF-TOKEN": auth.csrf },
  });
  assert(r.ok(), `${method} ${p}: ${r.status()}`);
  if (r.status() === 204) return null;
  assert(
    r.headers()["content-type"]?.includes("json"),
    `${method} ${p}: expected JSON; refresh the private synthetic session if it expired`,
  );
  return await r.json();
}
async function optional(p) {
  const r = await admin.request.get(base + p);
  if (r.status() === 404) return null;
  assert(r.ok(), `${p}: ${r.status()}`);
  return await r.json();
}
async function poll(fn, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(label);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    report.checks.push({ name, result: "passed", detail });
    console.log("PASS", name);
  } catch (e) {
    report.checks.push({ name, result: "failed", error: e.message });
    console.log("FAIL", name, e.message);
  }
  await save();
}
async function enabled(name, value) {
  await api(`${consolePath}/${name}/plugin-state`, "PUT", {
    enable: value,
    async: false,
  });
  await poll(async () => {
    const x = await api(`${resource}/${name}`);
    return x.spec.enabled === value && (!value || x.status.phase === "STARTED");
  }, "Plugin state did not settle");
}
async function snapshotComments() {
  const result = {};
  for (const kind of ["comments", "replies"]) {
    const x = await api(`/apis/content.halo.run/v1alpha1/${kind}?size=1000`);
    assert(!x.hasNext);
    result[kind] = x.items
      .map((x) => ({ name: x.metadata.name, spec: x.spec }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}
async function removePlugin(name) {
  if (!(await optional(`${resource}/${name}`))) return;
  await enabled(name, false);
  await api(`${resource}/${name}`, "DELETE");
  await poll(
    async () => !(await optional(`${resource}/${name}`)),
    "Plugin removal did not settle",
  );
}
async function installPlugin(p) {
  const r = await admin.request.post(base + consolePath + "/install", {
    headers: { "X-CSRF-TOKEN": auth.csrf },
    multipart: {
      file: {
        name: p.name + ".jar",
        mimeType: "application/java-archive",
        buffer: p.jar,
      },
    },
  });
  assert(r.ok(), `Reinstall ${p.name}: ${r.status()}`);
  await poll(
    async () => !!(await optional(`${resource}/${p.name}`)),
    "Plugin installation did not settle",
  );
}
async function view(
  route,
  verify,
  { width = 390, mode = "light", delayImages = false } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    locale: "zh-CN",
    colorScheme: mode,
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
  const requests = [],
    errors = [];
  let releaseImages;
  const imageGate = new Promise((r) => (releaseImages = r));
  let heldImages = 0;
  await context.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== base) return r.abort();
    requests.push(u.pathname);
    if (delayImages && r.request().resourceType() === "image") {
      heldImages++;
      await imageGate;
    }
    return r.continue().catch(() => {});
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(10000);
  try {
    const response = await page.goto(base + route, {
      waitUntil: "domcontentloaded",
    });
    assert(response?.ok(), `Page ${route}: ${response?.status()}`);
    await page.locator("#Butterfly").waitFor({ state: "attached" });
    await page.waitForFunction(
      (mode) => document.documentElement.dataset.colorScheme === mode,
      mode,
    );
    await verify(page, {
      requests,
      errors,
      get heldImages() {
        return heldImages;
      },
    });
    assert.deepEqual(errors, []);
  } finally {
    releaseImages();
    await context.close();
  }
}
async function assertMounts(plugin, present, assetsAbsent = !present) {
  const routes = plugin.includes("Search")
    ? ["/"]
    : ["/archives/preview-1/", "/about-preview/"];
  for (const route of routes) {
    const marker = plugin.includes("Search")
      ? "javascript:SearchWidget.open()"
      : 'id="post-comment"';
    await poll(async () => {
      const r = await admin.request.get(base + route);
      assert(r.ok());
      return (await r.text()).includes(marker) === present;
    }, "Theme mount state did not settle");
    await view(route, async (page, { requests }) => {
      const mount = plugin.includes("Search")
        ? '.nav a[title="搜索"]'
        : "#post-comment";
      assert.equal(await page.locator(mount).count(), present ? 1 : 0);
      if (present) {
        await page.locator(mount).scrollIntoViewIfNeeded();
        if (!plugin.includes("Search"))
          await page
            .locator("comment-widget [contenteditable]")
            .first()
            .waitFor();
      } else if (assetsAbsent)
        assert(
          !requests.some((x) =>
            x.startsWith("/plugins/" + plugin + "/assets/"),
          ),
          "Unavailable plugin assets requested",
        );
    });
  }
}
const originals = [];
let originalConfig,
  originalSystem,
  originalComments,
  originalTheme,
  originalPost;
try {
  const themes = await api("/apis/theme.halo.run/v1alpha1/themes");
  assert(
    themes.items.some((x) => x.metadata.name === "theme-earth"),
    "Built-in alternate theme required",
  );
  originalSystem = await api("/api/v1alpha1/configmaps/system");
  const themeGroup = JSON.parse(originalSystem.data.theme);
  originalTheme = themeGroup.active;
  assert.equal(originalTheme, "halo-butterfly-next");
  originalConfig = await api(configPath);
  originalPost = await api("/apis/content.halo.run/v1alpha1/posts/preview-1");
  originalComments = await snapshotComments();
  assert(
    originalComments.comments.length && originalComments.replies.length,
    "Run synthetic comment flows before lifecycle acceptance",
  );
  for (const p of lock.plugins) {
    const x = await api(`${resource}/${p.name}`);
    assert.equal(x.spec.version, p.version);
    const jar = await readFile(
      path.join(runtime, "halo/data/plugins", `${p.name}-${p.version}.jar`),
    );
    assert.equal(sha256(jar), p.sha256);
    const config = x.spec.configMapName
      ? await optional("/api/v1alpha1/configmaps/" + x.spec.configMapName)
      : null;
    await writeFile(
      path.join(output, `backup-${p.name}-${p.version}.jar`),
      jar,
      { flag: "wx" },
    );
    originals.push({ ...p, jar, enabled: x.spec.enabled, config });
  }
  await writeFile(
    path.join(output, "restore.private.json"),
    JSON.stringify(
      {
        theme: originalTheme,
        config: originalConfig,
        originalGlobalComment: originalSystem.data.comment ?? null,
        originalPostAllowComment: originalPost.spec.allowComment,
        plugins: originals.map(({ jar, ...p }) => p),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  for (const p of originals) {
    await enabled(p.name, true);
    await check(p.name + "-enabled", () => assertMounts(p.name, true));
    await enabled(p.name, false);
    await check(p.name + "-disabled", () => assertMounts(p.name, false));
    await enabled(p.name, true);
    await check(p.name + "-version-contract-fixture", async () => {
      const zip = await JSZip.loadAsync(p.jar);
      const manifest = parse(await zip.file("plugin.yaml").async("string"));
      manifest.spec.version = "0.0.1";
      zip.file("plugin.yaml", stringify(manifest));
      const mf = await zip.file("META-INF/MANIFEST.MF").async("string");
      zip.file(
        "META-INF/MANIFEST.MF",
        mf.replace(
          /Implementation-Version: [^\r\n]+/,
          "Implementation-Version: 0.0.1",
        ),
      );
      const jar = await zip.generateAsync({ type: "nodebuffer" });
      const fixture = { ...p, version: "0.0.1", jar };
      await writeFile(path.join(output, p.name + "-version-fixture.jar"), jar, {
        flag: "wx",
      });
      await removePlugin(p.name);
      try {
        await installPlugin(fixture);
        await enabled(p.name, true);
        assert.equal(
          (await api(`${resource}/${p.name}`)).spec.version,
          "0.0.1",
        );
        await assertMounts(p.name, false, false);
        return {
          declaredVersion: "0.0.1",
          sourceJarVersion: p.version,
          sourceJarSha256: p.sha256,
          fixtureSha256: sha256(jar),
          kind: "manifest-contract-fixture-not-real-old-release",
        };
      } finally {
        await removePlugin(p.name);
        await installPlugin(p);
        await enabled(p.name, true);
        await assertMounts(p.name, true);
      }
    });
    await check(p.name + "-uninstall-reinstall", async () => {
      await enabled(p.name, false);
      await api(`${resource}/${p.name}`, "DELETE");
      await poll(
        async () => !(await optional(`${resource}/${p.name}`)),
        "Plugin deletion did not settle",
      );
      try {
        await assertMounts(p.name, false);
      } finally {
        await installPlugin(p);
        await enabled(p.name, true);
      }
      await assertMounts(p.name, true);
      assert.deepEqual(await snapshotComments(), originalComments);
      return { jarSha256: p.sha256, commentResourcesPreserved: true };
    });
  }
  await check("comment-counts-default-hidden", () =>
    view("/", async (page) =>
      assert.equal(await page.locator(".comment-count").count(), 0),
    ),
  );
  await check("comment-counts-match-halo-and-switches", async () => {
    for (const flags of [
      { count: true, card_post_count: false },
      { count: false, card_post_count: true },
      { count: true, card_post_count: true },
    ]) {
      const x = await api(configPath);
      x.data.comments = JSON.stringify(flags);
      await api(configPath, "PUT", x);
      await poll(async () => {
        const html = await (await admin.request.get(base + "/")).text();
        return (
          html.includes('class="wp comment-count"') === flags.card_post_count
        );
      }, "Count setting did not settle");
      for (const route of ["/", "/categories/development/", "/tags/butterfly/"])
        await view(route, async (page) => {
          if (flags.count && flags.card_post_count && route === "/")
            await page.screenshot({
              path: path.join(output, "comment-counts-home.png"),
            });
          const cards = page.locator("ul.essay > li.item");
          assert(await cards.count());
          for (const card of await cards.all()) {
            const href = await card.locator("a.title").getAttribute("href");
            const name = new URL(href, base).pathname
              .split("/")
              .filter(Boolean)
              .at(-1);
            const post = await api(
              "/apis/api.content.halo.run/v1alpha1/posts/" + name,
            );
            const el = card.locator(".comment-count");
            assert.equal(
              await el.count(),
              flags.card_post_count && post.spec.allowComment ? 1 : 0,
            );
            if (await el.count())
              assert.equal(
                (await el.innerText()).trim(),
                "评论 " + post.stats.comment,
              );
          }
        });
      await view("/archives/preview-1/", async (page) => {
        const el = page.locator(".post-meta .comment-count");
        assert.equal(await el.count(), flags.count ? 1 : 0);
        if (flags.count) {
          const post = await api(
            "/apis/api.content.halo.run/v1alpha1/posts/preview-1",
          );
          assert.equal(
            (await el.innerText()).trim(),
            "评论 " + post.stats.comment,
          );
          await el.locator("a").click();
          assert(new URL(page.url()).hash === "#post-comment");
        }
      });
    }
  });
  await check("comment-counts-hide-with-permissions", async () => {
    async function absent() {
      await poll(
        async () =>
          !(
            await (
              await admin.request.get(base + "/archives/preview-1/")
            ).text()
          ).includes('class="wp comment-count"'),
        "Article count did not disappear",
      );
      for (const route of ["/", "/archives/preview-1/"])
        await view(route, async (page) => {
          const candidates = await page
            .locator(route === "/" ? "ul.essay > li.item" : ".post-meta")
            .all();
          let matched = 0;
          for (const target of candidates) {
            if (route === "/") {
              const href = await target.locator("a.title").getAttribute("href");
              if (
                new URL(href, base).pathname.replace(/\/$/, "") !==
                "/archives/preview-1"
              )
                continue;
            }
            matched++;
            assert.equal(
              await target.locator(".comment-count").count(),
              0,
              `Comment count remains visible on ${route}`,
            );
          }
          assert(matched > 0, `Missing count target on ${route}`);
        });
    }
    const postPath = "/apis/content.halo.run/v1alpha1/posts/preview-1";
    let post = await api(postPath);
    post.spec.allowComment = false;
    await api(postPath, "PUT", post);
    try {
      await absent();
    } finally {
      post = await api(postPath);
      post.spec.allowComment = originalPost.spec.allowComment;
      await api(postPath, "PUT", post);
    }
    const systemPath = "/api/v1alpha1/configmaps/system";
    let system = await api(systemPath);
    system.data.comment = JSON.stringify({
      ...JSON.parse(system.data.comment || "{}"),
      enable: false,
    });
    await api(systemPath, "PUT", system);
    try {
      await absent();
    } finally {
      system = await api(systemPath);
      if (Object.hasOwn(originalSystem.data, "comment"))
        system.data.comment = originalSystem.data.comment;
      else delete system.data.comment;
      await api(systemPath, "PUT", system);
    }
    await enabled("PluginCommentWidget", false);
    try {
      await absent();
    } finally {
      await enabled("PluginCommentWidget", true);
    }
  });
  await check("comment-count-accessibility", async () => {
    const axeRoot = path.join(
      REPO,
      ".runtime/plugin-a11y/node_modules/axe-core",
    );
    assert.equal(
      (await read(path.join(axeRoot, "package.json"))).version,
      "4.12.1",
    );
    const results = [];
    for (const width of [1440, 390])
      for (const mode of ["light", "dark"])
        for (const route of ["/", "/archives/preview-1/"]) {
          await view(
            route,
            async (page) => {
              await page.locator(".comment-count").first().waitFor();
              await page.addScriptTag({
                path: path.join(axeRoot, "axe.min.js"),
              });
              const audit = await page.evaluate(() =>
                window.axe.run(
                  { include: [[".comment-count"]] },
                  { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
                ),
              );
              const name = `count-a11y-${width}-${mode}-${route === "/" ? "home" : "post"}`;
              await writeFile(
                path.join(output, name + ".json"),
                JSON.stringify(audit, null, 2) + "\n",
              );
              await page
                .locator(".comment-count")
                .first()
                .scrollIntoViewIfNeeded();
              await page.screenshot({ path: path.join(output, name + ".png") });
              results.push({
                width,
                mode,
                route,
                violations: audit.violations.length,
                incomplete: audit.incomplete.length,
              });
              assert.equal(
                audit.violations.length,
                0,
                JSON.stringify(
                  audit.violations.map((v) => ({
                    id: v.id,
                    nodes: v.nodes.map((n) => n.failureSummary),
                  })),
                ),
              );
            },
            { width, mode },
          );
        }
    return results;
  });
  await check("theme-switch-preserves-comment-subjects", async () => {
    await api(themePath + "theme-earth/activation", "PUT");
    try {
      await poll(async () => {
        const response = await admin.request.get(base + "/");
        assert(response.ok(), "Alternate theme must render HTTP 200");
        return !(await response.text()).includes('id="Butterfly"');
      }, "Alternate theme did not activate");
      assert.deepEqual(await snapshotComments(), originalComments);
    } finally {
      await api(themePath + "halo-butterfly-next/activation", "PUT");
    }
    await assertMounts("PluginCommentWidget", true);
    assert.deepEqual(await snapshotComments(), originalComments);
    return {
      alternate: "theme-earth",
      comments: originalComments.comments.length,
      replies: originalComments.replies.length,
    };
  });
  for (const type of ["circle", "dot", "hourglass", "cross_line"])
    await check("loading-" + type + "-pending-images", async () => {
      const x = await api(configPath);
      const loading = JSON.parse(x.data.loading);
      loading.type = type;
      x.data.loading = JSON.stringify(loading);
      await api(configPath, "PUT", x);
      await poll(
        async () =>
          (
            await (
              await admin.request.get(base + "/archives/preview-1/")
            ).text()
          ).includes("/loading/" + type + ".min.js"),
        "Loading configuration did not settle",
      );
      for (const width of [1440, 390])
        for (const mode of ["light", "dark"])
          await view(
            "/archives/preview-1/",
            async (page, info) => {
              await page.locator("#post-comment").scrollIntoViewIfNeeded();
              await page
                .locator("comment-widget [contenteditable]")
                .first()
                .waitFor();
              assert(
                info.heldImages > 0,
                "No pending images: invalid fault injection",
              );
              assert.equal(
                await page.evaluate(() => document.readyState),
                "interactive",
              );
              assert(
                !(await page
                  .locator("body")
                  .evaluate((e) => e.classList.contains("loading"))),
              );
              await page.screenshot({
                path: path.join(output, `loading-${type}-${width}-${mode}.png`),
              });
            },
            { width, mode, delayImages: true },
          );
    });
} catch (e) {
  report.fatalError = e.message;
  console.error(e);
} finally {
  const restore = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      report.restoreErrors.push({ name, error: e.message });
    }
  };
  for (const p of originals)
    await restore(p.name, async () => {
      if (!(await optional(`${resource}/${p.name}`))) await installPlugin(p);
      const x = await api(`${resource}/${p.name}`);
      if (x.spec.version !== p.version) {
        await removePlugin(p.name);
        await installPlugin(p);
      }
      if (p.config) {
        const cur = await optional(
          "/api/v1alpha1/configmaps/" + p.config.metadata.name,
        );
        if (cur) {
          cur.data = p.config.data;
          await api(
            "/api/v1alpha1/configmaps/" + cur.metadata.name,
            "PUT",
            cur,
          );
        } else {
          const copy = {
            ...p.config,
            metadata: { name: p.config.metadata.name },
          };
          await api("/api/v1alpha1/configmaps", "POST", copy);
        }
      }
      if (p.config)
        assert.deepEqual(
          (await api("/api/v1alpha1/configmaps/" + p.config.metadata.name))
            .data,
          p.config.data,
        );
      await enabled(p.name, p.enabled);
      assert.equal(
        sha256(
          await readFile(
            path.join(
              runtime,
              "halo/data/plugins",
              `${p.name}-${p.version}.jar`,
            ),
          ),
        ),
        p.sha256,
      );
    });
  if (originalConfig)
    await restore("theme-comments-and-loading", async () => {
      const x = await api(configPath);
      for (const k of ["comments", "loading"]) {
        if (Object.hasOwn(originalConfig.data, k))
          x.data[k] = originalConfig.data[k];
        else delete x.data[k];
      }
      await api(configPath, "PUT", x);
      const actual = await api(configPath);
      for (const k of ["comments", "loading"])
        assert.equal(actual.data[k], originalConfig.data[k]);
    });
  if (originalPost)
    await restore("post-allow-comment", async () => {
      const p = "/apis/content.halo.run/v1alpha1/posts/preview-1";
      const x = await api(p);
      x.spec.allowComment = originalPost.spec.allowComment;
      await api(p, "PUT", x);
      assert.equal(
        (await api(p)).spec.allowComment,
        originalPost.spec.allowComment,
      );
    });
  if (originalSystem)
    await restore("global-comment", async () => {
      const p = "/api/v1alpha1/configmaps/system";
      const x = await api(p);
      if (Object.hasOwn(originalSystem.data, "comment"))
        x.data.comment = originalSystem.data.comment;
      else delete x.data.comment;
      await api(p, "PUT", x);
      assert.equal((await api(p)).data.comment, originalSystem.data.comment);
    });
  if (originalTheme)
    await restore("active-theme", async () => {
      await api(themePath + originalTheme + "/activation", "PUT");
      await poll(
        async () =>
          JSON.parse((await api("/api/v1alpha1/configmaps/system")).data.theme)
            .active === originalTheme,
        "Active theme restoration not confirmed",
      );
    });
  if (originalComments)
    await restore("comment-resources", async () =>
      assert.deepEqual(await snapshotComments(), originalComments),
    );
  await admin.close();
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.result =
    report.fatalError ||
    report.restoreErrors.length ||
    report.checks.some((x) => x.result === "failed")
      ? "failed"
      : "passed-tested-scope";
  await save();
}
process.exitCode = report.result === "failed" ? 1 : 0;
