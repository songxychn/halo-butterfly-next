/** Real plugin flows in an explicitly owned, synthetic Halo comparison lab. */
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
const options = {};
for (let i = 2; i < process.argv.length; i += 2)
  options[process.argv[i]] = process.argv[i + 1];
for (const k of [
  "--lab-runtime",
  "--theme-package",
  "--theme-source-sha",
  "--output",
])
  assert(options[k], k + " required");
assert.equal(
  options["--allow-synthetic-writes"],
  "yes",
  "Explicit --allow-synthetic-writes yes required",
);
const runtime = await realpath(options["--lab-runtime"]);
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const marker = await read(path.join(runtime, "lab.json"));
const base = validateBaseUrl(process.env.BASE_URL, marker);
await read(path.join(runtime, "seed.json"));
const installed = await read(path.join(runtime, "installed-package.json"));
validatePackage(
  installed,
  options["--theme-source-sha"],
  sha256(await readFile(options["--theme-package"])),
);
const lock = await read(
  path.join(REPO, "fixtures/search-comment/versions.json"),
);
const authPath = path.join(runtime, "plugin-auth.private.json");
assert.equal(
  (await stat(authPath)).mode & 0o077,
  0,
  "Synthetic auth must be private",
);
const auth = await read(authPath);
const output = path.resolve(options["--output"]);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const report = {
  schema: 1,
  startedAt: new Date().toISOString(),
  runnerSha: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runnerFileSha256: sha256(await readFile(new URL(import.meta.url))),
  workingTreeClean: !execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  theme: installed,
  plugins: lock.plugins,
  checks: [],
  comments: [],
  limitations: [
    "Headless Chromium, not real mobile keyboard or Safari.",
    "SearchWidget 1.7.1 has no result pagination (limit 20).",
    "Synthetic logged-in user is the fixture maintainer; no claim about every user role.",
    "External avatar requests are blocked; no external integration acceptance.",
  ],
  contractAcceptance: false,
};
const poll = async (fn, message) => {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(message);
};
const save = () =>
  writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
async function check(name, fn) {
  try {
    const detail = await fn();
    report.checks.push({ name, result: "passed", detail });
    console.log("PASS", name);
    return detail;
  } catch (e) {
    report.checks.push({ name, result: "failed", error: e.message });
    console.log("FAIL", name, e.message.slice(0, 150));
  } finally {
    await save();
  }
}
Object.assign(process.env, browserEnvironment());
const { chromium } = await import(
  pathToFileURL(path.join(RUNTIME, "deps/node_modules/playwright/index.mjs"))
);
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const admin = await browser.newContext({
  storageState: { cookies: auth.cookies, origins: [] },
});
async function api(p, method = "GET", data) {
  assert(p.startsWith("/"));
  const r = await admin.request.fetch(base + p, {
    method,
    data,
    headers: { "X-CSRF-TOKEN": auth.csrf },
  });
  assert(r.ok(), method + " " + p + " HTTP " + r.status());
  return r.status() === 204 ? null : await r.json();
}
const systemPath = "/api/v1alpha1/configmaps/system";
let originalSystem;
const originalPlugins = [];
const originalAllows = [];
let context;
const commentSetting = async (data) => {
  const x = await api(systemPath);
  x.data.comment = JSON.stringify(data);
  await api(systemPath, "PUT", x);
};
async function fresh(width, mode, signedIn = false, route = "/") {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    locale: "zh-CN",
    colorScheme: mode,
    storageState: {
      cookies: signedIn ? auth.cookies : [],
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
  await context.route("**/*", (r) => {
    const u = new URL(r.request().url());
    return u.origin === base || ["data:", "blob:"].includes(u.protocol)
      ? r.continue()
      : r.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(30000);
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  return page;
}
async function comments(page) {
  await page.locator("#post-comment").scrollIntoViewIfNeeded();
  await page.locator("comment-widget [contenteditable]").first().waitFor();
}
async function submit(page, form, text, anonymous, reply = false) {
  await form.locator("[contenteditable]").fill(text);
  if (anonymous) {
    await form.locator('input[name="displayName"]').fill("合成访客");
    await form.locator('input[name="email"]').fill("fixture@example.invalid");
  }
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.startsWith(
        "/apis/api.halo.run/v1alpha1/comments",
      ) &&
      (reply
        ? r.url().endsWith("/reply")
        : new URL(r.url()).pathname.endsWith("/comments")),
  );
  await form.locator("button.form-submit").click();
  const r = await response;
  assert.equal(r.status(), 200);
  const x = await r.json();
  assert(x.metadata?.name);
  return x;
}
try {
  originalSystem = await api(systemPath);
  report.browser = browser.version();
  for (const p of lock.plugins) {
    const x = await api("/apis/plugin.halo.run/v1alpha1/plugins/" + p.name);
    assert.equal(x.spec.version, p.version);
    assert.equal(
      sha256(
        await readFile(
          path.join(
            runtime,
            "halo/data/plugins",
            p.name + "-" + p.version + ".jar",
          ),
        ),
      ),
      p.sha256,
    );
    originalPlugins.push({ name: p.name, enabled: x.spec.enabled });
    assert.equal(x.status.phase, "STARTED");
  }
  for (const width of [1440, 390])
    for (const mode of ["light", "dark"]) {
      const label = `search-${width}-${mode}`;
      let page = await fresh(width, mode);
      await check(label + "-query-and-navigation", async () => {
        await page.waitForFunction(
          () => typeof window.SearchWidget?.open === "function",
        );
        const trigger = page.locator('.nav a[title="搜索"]');
        await trigger.click();
        const input = page.getByPlaceholder("输入关键词以搜索");
        await input.waitFor();
        for (const keyword of [
          "排版",
          "Butterfly",
          "unmatchedfixture20260920xyz",
        ]) {
          const promise = page.waitForResponse(
            (r) =>
              r.request().method() === "POST" &&
              r.url().endsWith("/indices/-/search") &&
              r.request().postDataJSON()?.keyword === keyword,
          );
          await input.fill(keyword);
          const r = await promise;
          assert.equal(r.status(), 200);
          const data = await r.json();
          if (keyword.startsWith("unmatched")) {
            assert.equal(data.hits.length, 0);
            await page
              .locator("search-modal")
              .getByText("没有搜索结果", { exact: true })
              .waitFor();
          } else {
            assert(data.hits.length > 0);
            await page.locator("search-modal h2").first().waitFor();
          }
        }
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => document.querySelector("search-modal").open === false,
        );
        await check(label + "-escape-focus-return", async () => {
          assert(
            await trigger.evaluate((e) => document.activeElement === e),
            "Escape focus did not return to search trigger",
          );
        });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await input.waitFor();
        await page
          .locator("search-modal .modal__layer")
          .click({ position: { x: 5, y: 5 } });
        await page.waitForFunction(
          () => document.querySelector("search-modal").open === false,
        );
        await trigger.click();
        await input.waitFor();
        await input.fill("排版");
        await page
          .locator("search-modal h2")
          .filter({ hasText: "排版" })
          .waitFor();
        await page.screenshot({ path: path.join(output, label + ".png") });
        await Promise.all([
          page.waitForURL(
            (u) => u.pathname.replace(/\/$/, "") === "/archives/preview-1",
            { waitUntil: "domcontentloaded" },
          ),
          input.press("Enter"),
        ]);
        await page
          .locator("h1")
          .filter({ hasText: "Butterfly 对照：排版与交互" })
          .waitFor();
        return {
          chinese: true,
          english: true,
          empty: true,
          keyboardOpenAndResult: true,
          escapeClose: true,
          backdropClose: true,
        };
      });
    }
  await commentSetting({
    enable: true,
    systemUserOnly: true,
    requireReviewForNew: false,
  });
  await check("anonymous-disallowed-with-login-feedback", async () => {
    const p = await fresh(390, "light", false, "/archives/preview-1/");
    await comments(p);
    const f = p.locator("comment-form");
    await f.locator("[contenteditable]").fill("blocked anonymous fixture");
    let writes = 0;
    p.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/comments")) writes++;
    });
    await f.locator("button.form-submit").click();
    await p.getByText("请先登录", { exact: true }).waitFor();
    assert.equal(writes, 0);
    assert(await f.locator("a.form-login").isVisible());
  });
  await commentSetting({
    enable: true,
    systemUserOnly: false,
    requireReviewForNew: false,
  });
  for (const [width, mode, signedIn, route] of [
    [1440, "light", false, "/archives/preview-1/"],
    [390, "dark", false, "/about-preview/"],
    [390, "light", true, "/archives/preview-1/"],
    [1440, "dark", true, "/about-preview/"],
  ]) {
    const label = `comment-${width}-${mode}-${signedIn ? "signed" : "anonymous"}`;
    await check(label, async () => {
      const p = await fresh(width, mode, signedIn, route);
      await comments(p);
      const f = p.locator("comment-form");
      assert.equal(
        await f.locator("[contenteditable]").getAttribute("aria-label"),
        "编写评论",
      );
      const text = "合成验收 " + label + " " + Date.now();
      if (!signedIn) {
        await f.locator("[contenteditable]").fill(text);
        await f.locator("button.form-submit").click();
        assert(
          await f
            .locator('input[name="displayName"]')
            .evaluate((e) => !e.validity.valid && !!e.validationMessage),
          "Missing anonymous name must show native validation",
        );
      }
      const x = await submit(p, f, text, !signedIn);
      assert.equal(
        x.spec.subjectRef.name,
        route.includes("about") ? "about-preview" : "preview-1",
      );
      const record = {
        label,
        commentId: x.metadata.name,
        subject: x.spec.subjectRef,
      };
      report.comments.push(record);
      const item = p
        .locator("comment-item")
        .filter({
          has: p.locator("comment-content").getByText(text, { exact: true }),
        })
        .first();
      await item.waitFor();
      const replyControl = item.locator(
        (await item.locator(".reply-button").count())
          ? ".reply-button"
          : ".show-replies-button",
      );
      await replyControl.click();
      const rf = item.locator("reply-form");
      await rf.locator("[contenteditable]").waitFor();
      const replyText = "合成回复 " + Date.now();
      const reply = await submit(p, rf, replyText, !signedIn, true);
      assert.equal(reply.spec.commentName, x.metadata.name);
      await item.getByText(replyText, { exact: true }).waitFor();
      record.replyId = reply.metadata.name;
      await p.screenshot({ path: path.join(output, label + ".png") });
      return record;
    });
  }
  await check("anonymous-pending-review", async () => {
    await commentSetting({
      enable: true,
      systemUserOnly: false,
      requireReviewForNew: true,
    });
    const p = await fresh(390, "light", false, "/about-preview/");
    await comments(p);
    const x = await submit(
      p,
      p.locator("comment-form"),
      "合成待审核 " + Date.now(),
      true,
    );
    assert.equal(x.spec.approved, false);
    await p.getByText("评论成功，请等待审核", { exact: true }).waitFor();
    return { commentId: x.metadata.name, approved: x.spec.approved };
  });
  await check("simulated-server-error-keeps-draft", async () => {
    await commentSetting({
      enable: true,
      systemUserOnly: false,
      requireReviewForNew: false,
    });
    const p = await fresh(390, "light", false, "/about-preview/");
    await comments(p);
    const f = p.locator("comment-form");
    const text = "合成失败保留草稿";
    await f.locator("[contenteditable]").fill(text);
    await f.locator('input[name="displayName"]').fill("合成访客");
    await f.locator('input[name="email"]').fill("fixture@example.invalid");
    await p.route(base + "/apis/api.halo.run/v1alpha1/comments", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({
            status: 503,
            contentType: "application/problem+json",
            body: JSON.stringify({
              title: "合成服务不可用",
              detail: "fixture failure injection",
            }),
          })
        : r.continue(),
    );
    await f.locator("button.form-submit").click();
    await p.getByText(/合成服务不可用/).waitFor();
    assert.equal(
      (await f.locator("[contenteditable]").textContent()).trim(),
      text,
    );
    return { faultInjection: true, status: 503, draftPreserved: true };
  });
  for (const [kind, name, route] of [
    ["posts", "preview-1", "/archives/preview-1/"],
    ["singlepages", "about-preview", "/about-preview/"],
  ]) {
    await check(kind + "-per-content-disable-restore", async () => {
      const p = "/apis/content.halo.run/v1alpha1/" + kind + "/" + name;
      let x = await api(p);
      originalAllows.push({ path: p, value: x.spec.allowComment });
      x.spec.allowComment = false;
      await api(p, "PUT", x);
      await poll(
        async () =>
          !(await (await admin.request.get(base + route)).text()).includes(
            'id="post-comment"',
          ),
        "Comment mount did not disappear",
      );
      x = await api(p);
      x.spec.allowComment = true;
      await api(p, "PUT", x);
      await poll(
        async () =>
          (await (await admin.request.get(base + route)).text()).includes(
            'id="post-comment"',
          ),
        "Comment mount did not return",
      );
    });
  }
  await check("global-comment-disable-restore", async () => {
    await commentSetting({
      enable: false,
      systemUserOnly: false,
      requireReviewForNew: false,
    });
    try {
      for (const r of ["/archives/preview-1/", "/about-preview/"])
        await poll(
          async () =>
            !(await (await admin.request.get(base + r)).text()).includes(
              'id="post-comment"',
            ),
          "Global comment disable not reflected",
        );
    } finally {
      await commentSetting({
        enable: true,
        systemUserOnly: false,
        requireReviewForNew: false,
      });
      await poll(
        async () =>
          (
            await (
              await admin.request.get(base + "/archives/preview-1/")
            ).text()
          ).includes('id="post-comment"'),
        "Global comment enable not reflected",
      );
    }
  });
  for (const enabled of [false, true])
    for (const plugin of originalPlugins) {
      await check(plugin.name + "-enabled-" + enabled, async () => {
        await api(
          "/apis/api.console.halo.run/v1alpha1/plugins/" +
            plugin.name +
            "/plugin-state",
          "PUT",
          { enable: enabled, async: false },
        );
        const route = plugin.name.includes("Search")
          ? "/"
          : "/archives/preview-1/";
        let html;
        await poll(async () => {
          html = await (await admin.request.get(base + route)).text();
          return (
            html.includes(
              plugin.name.includes("Search")
                ? "javascript:SearchWidget.open()"
                : 'id="post-comment"',
            ) === enabled
          );
        }, "Plugin entry state did not settle");
        if (!enabled)
          assert(!html.includes("/plugins/" + plugin.name + "/assets/"));
      });
    }
  report.limitations.push(
    "Uninstalled/unsupported plugin versions, real theme switching, all user roles and complete keyboard focus containment remain unverified.",
  );
} catch (e) {
  report.fatalError = e.message;
  throw e;
} finally {
  try {
    for (const x of originalAllows) {
      const current = await api(x.path);
      current.spec.allowComment = x.value;
      await api(x.path, "PUT", current);
    }
    if (originalSystem) {
      const current = await api(systemPath);
      if (Object.hasOwn(originalSystem.data, "comment"))
        current.data.comment = originalSystem.data.comment;
      else delete current.data.comment;
      await api(systemPath, "PUT", current);
      assert.equal(
        (await api(systemPath)).data.comment,
        originalSystem.data.comment,
      );
    }
    for (const x of originalPlugins)
      await api(
        "/apis/api.console.halo.run/v1alpha1/plugins/" +
          x.name +
          "/plugin-state",
        "PUT",
        { enable: x.enabled, async: false },
      );
    for (const x of originalAllows)
      assert.equal((await api(x.path)).spec.allowComment, x.value);
    for (const x of originalPlugins)
      assert.equal(
        (await api("/apis/plugin.halo.run/v1alpha1/plugins/" + x.name)).spec
          .enabled,
        x.enabled,
      );
    report.fixtureRestored = true;
  } catch (e) {
    report.fixtureRestored = false;
    report.restoreError = e.message;
  }
  if (context) await context.close();
  await admin.close();
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.result =
    report.fatalError ||
    report.checks.some((x) => x.result === "failed") ||
    !report.fixtureRestored
      ? "failed"
      : "passed-tested-scope";
  await save();
}
process.exitCode = report.result === "failed" ? 1 : 0;
