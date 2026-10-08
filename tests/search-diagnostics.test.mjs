import {test} from 'bun:test';
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { diagnosticUrl, observeSearchPage } from "../scripts/search-comment/diagnostics.mjs";

function fixture() {
  const page = new EventEmitter();
  page.url = () => "http://fixture.invalid/article?token=secret#private";
  page.evaluate = async () => "loading";
  const frame = { url: page.url };
  page.mainFrame = () => frame;
  const request = (method = "GET") => ({
    url: () => "http://user:password@fixture.invalid/script.js?token=secret#private",
    method: () => method,
    resourceType: () => "script",
    failure: () => ({ errorText: "net::ERR_FAILED https://private.invalid/?token=secret" }),
  });
  return { page, frame, request };
}

test("diagnostic URLs remove credentials, query and fragment and reject non-HTTP payloads", () => {
  assert.deepEqual(diagnosticUrl("https://user:password@fixture.invalid:8443/post?q=secret#token"), {
    origin: "https://fixture.invalid:8443", path: "/post",
  });
  for (const value of ["data:text/plain,secret", "blob:https://fixture.invalid/secret", "not a url"])
    assert.equal(diagnosticUrl(value), null);
});

test("same-URL concurrent requests retain separate pending state and status; listeners detach", async () => {
  const { page, frame, request } = fixture();
  const diagnostics = observeSearchPage(page, "search-case");
  const first = request(), second = request("POST");
  page.emit("request", first);
  page.emit("request", second);
  page.emit("response", { request: () => second, status: () => 200 });
  page.emit("requestfinished", first);
  page.emit("framenavigated", frame);
  page.emit("domcontentloaded");
  const snapshot = await diagnostics.snapshot();
  assert.equal(snapshot.pending.length, 1);
  assert.equal(snapshot.pending[0].method, "POST");
  assert.equal(snapshot.pending[0].status, 200);
  assert.equal(snapshot.readyState, "loading");
  page.emit("requestfailed", second);
  page.emit("load");
  await diagnostics.finish();
  assert.deepEqual(diagnostics.report.final.pending, []);
  const failure = diagnostics.report.events.find(x => x.event === "requestfailed");
  assert.equal(failure.errorCode, "net::ERR_FAILED");
  assert(!JSON.stringify(diagnostics.report).match(/secret|password|private|user:/));
  assert.equal(diagnostics.report.events.find(x => x.event === "framenavigated").mainFrame, true);
  assert.equal(page.eventNames().length, 0);
});

test("event/pending limits and unavailable document state remain explicit, never a test pass", async () => {
  const { page, request } = fixture();
  const diagnostics = observeSearchPage(page, "bounded", { maxEvents: 2, maxPending: 1, snapshotTimeoutMs: 5 });
  for (let i = 0; i < 4; i++) page.emit("request", request());
  page.evaluate = () => new Promise(() => {});
  assert.equal((await diagnostics.snapshot()).readyState, "unavailable");
  page.evaluate = async () => { throw new Error("context destroyed with secret data"); };
  await diagnostics.finish();
  assert.equal(diagnostics.report.final.readyState, "unavailable");
  assert.equal(diagnostics.report.events.length, 2);
  assert.equal(diagnostics.report.droppedEvents, 2);
  assert.equal(diagnostics.report.final.pending.length, 1);
  assert.equal(diagnostics.report.droppedPending, 3);
  assert.equal(diagnostics.report.result, undefined);
});
