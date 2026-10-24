# WebKit request attribution (offline only)

The fixed acceptance batch remains authoritative, including every cancellation.
This parser produces a diagnostic ledger, never a passing acceptance result.
It does not start browsers, contact Halo, change interception or retry navigation.

For a separately authorized fixed WebKit dark five-loop diagnostic, the caller
can set `DEBUG=pw:protocol` **before importing Playwright** and capture stderr to
a newly created mode-0600 file under this worktree's ignored `.runtime/`. Keep
the complete log private: protocol messages can contain cookies, responses and
script text. Do not commit it. Ensure `MAX_LOG_LENGTH` does not truncate messages;
the pinned Playwright 1.63.0 defaults to no per-message truncation. Capturing
protocol events adds observation overhead, so this is not a performance sample.

```sh
bun scripts/acceptance/combinations/analyze-webkit-protocol.mjs \
  "$PWD/.runtime/<diagnostic>/protocol.private.log" \
  "$PWD/.runtime/<diagnostic>/protocol-analysis.json"
```

Both paths must remain in this worktree's runtime. The input must be a regular
0600 file, at most 256 MiB; the output parent must exist and output must not exist.
Symlink input paths/output parents are refused. The parser records source/parser
digests and parse/truncation warnings. It does not reproduce raw headers, cookies,
query strings, fragments, credentials, arbitrary console messages or scripts.
URLs retain origin/path only; failure text is hashed with a cancellation category.
Public metadata still contains fixture paths and must be reviewed before sharing.

The installed `webkit-2359/protocol.json` declares `Network.requestWillBeSent`
with `frameId`, `loaderId`, `documentURL` and `initiator`. Parser initiators can
carry URL/line; script initiators can carry stack locations; `nodeId` is optional.
`Page.frameNavigated` declares the committed loader. The offline parser unwraps
`Target.dispatchMessageFromTarget`, namespaces request/frame/document IDs by
page proxy and target, and retains provisional-target swaps. Public Playwright
`Request.frame()` alone cannot distinguish successive documents in one frame;
`newCDPSession()` is Chromium-only and is not used here.

Failure relations are deliberately narrow:

- `old-document`: the exact known loader has been superseded/detached, or its
  target has explicitly been swapped out at the failure event.
- `during-current`: that loader is still the committed document at the failure
  event. A navigation may already be departing before the next commit, so this
  does **not** establish an in-page loading defect.
- `unknown`: IDs or a committed owner are missing. Matching URLs, `stage`, a
  referer or the current page URL cannot fill that gap.

All request failures and HTTP errors remain in the ledger, including failures
with no preceding request event. Navigation-policy events, Document requests,
commit events and protocol timestamps are retained for temporal comparison.
Cross-target timestamp clocks must not be assumed identical; event sequence and
target-swap records are separate evidence. No relation exempts a failed request.

`imageRequests` supplies document/loader references and optional initiator node
IDs for comparison with the diagnostic browser report's `beforeNavigation`
snapshots (`url`, `timeOrigin`, destination and image `src/currentSrc/loading/
complete/naturalWidth/connected/top`). That comparison can locate candidate lazy
images but does not prove an exact node match: DOM element indices/keys are not
WebKit backend node IDs, and multiple elements or documents may share a URL.
Likewise, a protocol loader identifies the requesting document; it does not by
itself explain why the request was cancelled. Missing evidence stays unknown.

## Fixed local controls

`cancellation-controls.mjs <new-runtime-output>` uses a new loopback-only HTTP
server and fresh headless WebKit for three controls: successful in-document
image, genuine in-document HTTP 404, and a pending old-document image canceled
by native navigation. It never contacts Halo. Capture its stderr with
`DEBUG=pw:protocol` in a newly created mode-0600 runtime file when protocol
attribution is needed; the output directory must not already exist.

The server holds the pending response without headers until the browser leaves;
no failed request event is fabricated. The cancellation must be observed before
context closure. Context/browser closes are bounded, and an owned worker process
group is terminated at 85 seconds (90-second overall limit). Results and failures
are retained. A local control only establishes the behavior of that controlled
case, never the cause or pass status of a historical Halo request.

Current scoped behavior is tested by `bun test tests/webkit-protocol.test.mjs`.
The tests cover loader/target identity, missing evidence, HTTP errors, the exact
WebKit `StyleSheet` type, privacy filtering and incomplete-log warnings.

## Six-case acceptance with attribution

`run.py --profile six-cases-attributed` retains the original six cases, five loops,
timeouts and strict failure gates. Its whole private protocol log mixes Chromium,
Firefox and WebKit. **Do not pass that mixed log directly to the WebKit parser.**
The runner writes explicit `HBN_COMBINATION_PROTOCOL` JSON lifecycle markers to
the same stderr stream, without changing Playwright's logger or browser methods.

```sh
bun scripts/acceptance/combinations/extract-webkit-protocol.mjs \
  "$PWD/.runtime/<run>/protocol.private.log" \
  "$PWD/.runtime/<run>/webkit-protocol.private.log" \
  "$PWD/.runtime/<run>/webkit-segment.json"
bun scripts/acceptance/combinations/analyze-webkit-protocol.mjs \
  "$PWD/.runtime/<run>/webkit-protocol.private.log" \
  "$PWD/.runtime/<run>/webkit-analysis.json"
```

Extraction preserves the whole original log and copies the exact WebKit engine
byte interval, including unknown protocol events. The manifest records source and
slice hashes, byte/line boundaries, engine/case windows and context-close starts
and finishes. It requires all three engine scopes, both ordered cases per engine,
matching run IDs, nondecreasing monotonic marker times and completed closes.
Missing/overlapping/unknown boundaries or failed closes produce an incomplete
manifest and no slice. A failed content assertion can still have complete capture;
capture completeness does not change the acceptance verdict.

Public observations are recorded for all engines. `navigationIntents` records
initial goto and link-click intent immediately before the action. `beforeNavigation`
captures the departing document's images; `afterDocumentReady` includes initial,
native-document-ready and checkpoint resource observations. A checkpoint keeps
the pending-request list from the original deadline before collecting its extra
snapshot. `contextCloseStarted` and `contextCloseFinished` separate observations
before/during teardown; cancellation in either window remains a strict failure.
The final error gate still runs after all contexts and browsers close.

`documentCommits` contains public `framenavigated` notifications, including
same-document navigation: do not count each as a new document. ResourceTiming
entries only show recorded completed image timing entries, not every pending or
failed request. Image URL matches and frame URLs are supporting observations;
precise loader ownership comes only from the WebKit protocol. No field here
automatically distinguishes a normal departure from a product fault or exempts
an earlier failed batch. The added layout reads/logging can affect timing.
