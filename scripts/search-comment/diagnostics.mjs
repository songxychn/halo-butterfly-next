/** Anonymous search diagnostics only; never collect headers, bodies or storage. */
export function diagnosticUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return { origin: url.origin, path: url.pathname };
  } catch {
    return null;
  }
}

export function observeSearchPage(page, name, {
  maxEvents = 600,
  maxPending = 300,
  snapshotTimeoutMs = 1000,
} = {}) {
  const startedAt = Date.now();
  const report = { name, events: [], droppedEvents: 0, droppedPending: 0 };
  const pending = new Map();
  const listeners = [];
  const record = (event, detail) => {
    if (report.events.length < maxEvents)
      report.events.push({ elapsedMs: Date.now() - startedAt, event, ...detail });
    else report.droppedEvents++;
  };
  const requestDetail = request => ({
    url: diagnosticUrl(request.url()),
    method: request.method(),
    resourceType: request.resourceType(),
  });
  const on = (event, listener) => {
    page.on(event, listener);
    listeners.push([event, listener]);
  };
  on("request", request => {
    const detail = requestDetail(request);
    if (pending.size < maxPending) pending.set(request, detail);
    else report.droppedPending++;
    record("request", detail);
  });
  on("response", response => {
    const request = response.request();
    const detail = { ...requestDetail(request), status: response.status() };
    if (pending.has(request)) pending.set(request, detail);
    record("response", detail);
  });
  on("requestfinished", request => {
    pending.delete(request);
    record("requestfinished", requestDetail(request));
  });
  on("requestfailed", request => {
    pending.delete(request);
    // Raw error strings can embed URLs; retain only a Chromium network code.
    const errorCode = request.failure()?.errorText?.match(/\bnet::ERR_[A-Z0-9_]+\b/)?.[0] ?? null;
    record("requestfailed", { ...requestDetail(request), errorCode });
  });
  on("framenavigated", frame => record("framenavigated", {
    url: diagnosticUrl(frame.url()), mainFrame: frame === page.mainFrame(),
  }));
  for (const event of ["domcontentloaded", "load"])
    on(event, () => record(event, { url: diagnosticUrl(page.url()) }));

  async function snapshot() {
    const state = {
      elapsedMs: Date.now() - startedAt,
      url: diagnosticUrl(page.url()),
      pending: [...pending.values()],
      readyState: "unavailable",
    };
    let timer;
    try {
      const value = await Promise.race([
        page.evaluate(() => document.readyState),
        new Promise(resolve => { timer = setTimeout(() => resolve("unavailable"), snapshotTimeoutMs); }),
      ]);
      if (["loading", "interactive", "complete"].includes(value)) state.readyState = value;
    } catch {
      // A destroyed navigation context is evidence, not a second test failure.
    } finally {
      clearTimeout(timer);
    }
    return state;
  }

  return {
    report,
    snapshot,
    async finish() {
      report.final = await snapshot();
      for (const [event, listener] of listeners) page.off(event, listener);
    },
  };
}
