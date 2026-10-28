# Lightbox regression

> 2026-10-28：页面作用域与 PJAX 竞态脚本 `race.mjs` 已退休；本文的相关旧命令仅供历史追溯。当前入口见 [维护范围](../../docs/MAINTENANCE.md)。

`check.mjs` exercises the real compiled theme adapter with fresh headless
Chromium, Firefox and WebKit at desktop/mobile widths. It covers the normal
toolbar, keyboard/focus, groups, links, reinitialization and Chromium touch input.

```sh
bun scripts/lightbox/check.mjs .runtime/lightbox/<new-run>
```

`race.mjs` isolates the native image event ordering that can occur around a
lightbox close or page cleanup. It compiles the actual `AmplifyImg.ts`, its CSS
and page lifecycle with the installed Viewer.js dependency. Browser URLs are
fulfilled locally; it never contacts Halo, an external service or an existing
user browser. Existing task-owned Playwright binaries/dependencies under
`.runtime/browser-matrix` are required.

```sh
bun scripts/lightbox/race.mjs clean .runtime/viewer-race-20261017/<new-run>
```

The fixed ten cases are three engines times early Escape, early page cleanup,
and normal viewing, plus a Chromium broken-image case. A document capture
listener closes the actual adapter during a genuine native image `load` event,
before Viewer's handler executes. Early Escape is a synthetic keyboard event;
page cleanup calls the actual exported `beginPage`. Normal and reopened-image
closing uses Playwright keyboard input. No fake load event, `complete` getter,
Viewer private-method override or global error suppression is used.

Each case checks native event identity, another image reopening, exact trigger
focus, restored original inert states, host/style removal and PageScope cleanup.
The broken-image response is deliberately HTTP 404 with a non-image body; it
must produce no page exception and still allow closing/reopening. The adapter
does not promise thumbnail fallback for a broken original URL.

Actions are bounded to 10 seconds, each case to 30 seconds, and context/browser
closure to 10 seconds. The tool saves source, bundle and runner fingerprints,
full page-error stacks and observations, then checks errors again after context
closure and before the final summary. Use a new output directory for every run.

`baseline` replaces `clean` only when testing an unfixed checkout: it requires
exactly one `null.style` exception from the compiled bundle in each of the six
early-close cases and none in the controls. A successful baseline capture still
records six product failures; it is not a passing product result.

These deterministic sequences prove the isolated lifecycle defect and its fix.
They cannot recover the missing stack from an earlier Halo navigation failure,
prove that failure had the same cause, or replace installed-theme acceptance.
