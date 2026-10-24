# Bounded combination follow-up

Run only after RSS and image batches finish, on an already-running, task-owned
Halo 2.26.1 lab. The coordinator does not start or stop processes and never
changes a plugin. Required official versions: CommentWidget 3.3.2, KaTeX 3.0.0,
Moments 1.18.0, Links 2.3.0, all `enabled=true / phase=STARTED`. If installed,
the experimental layout-probe plugin must already be DISABLED. KaTeX frontend
rendering must be off for the default-editor MathML format.

```sh
python3 scripts/acceptance/combinations/run.py \
  --runtime "$PWD/.runtime/performance-followup/halo-lab" \
  --package "$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --allow-synthetic-writes yes
```

The tool verifies the official Halo/plugin JARs and all 269 installed theme
files. It temporarily enables PJAX, immediate comment mounting, math/TeX copy,
and code enhancement in the owned lab, with native Links and global comments.
Original theme/system settings are restored and read back. Station snapshots
include each existing published Post/SinglePage release-content response digest,
as well as existing object specs and all plugin configuration digests. It creates one
uniquely labelled Post, Moment, LinkGroup and Link, then deletes only the exact
registered names, creation timestamps, owner labels and spec identities. Halo
2.26.1 does not supply a metadata UID; none is assumed. A create response lost
before registration is left for explicit inspection rather than unsafe cleanup.
Post publication has one 20-second setup deadline, including the publish call:
the released `raw` and `content` must both match the saved fixture HTML before
the final Post is reread and its cleanup spec digest frozen. Name, owner label,
creation timestamp and `spec.owner` remain fixed. Only Halo's publication fields
(`publish`, `headSnapshot`, `releaseSnapshot`, `publishTime`) may change; snapshot
references must resolve to the original draft snapshot, an existing publish time
must remain unchanged, and all other spec fields must match. Setup observations
and the released-content digest are recorded. Missing content or a late response
fails setup; it never retries browser navigation or relaxes cleanup ownership.
For an approved Moment, setup waits at most 20 seconds for the official
controller to add `approvedTime` and acknowledge the resource version. Only
that exact addition is allowed; before/after specs and polling results are
recorded, and cleanup still compares the complete final spec digest.

Each of six headless cases (Chromium/Firefox/WebKit, 390px, light/dark) begins
with one article load and performs five Article → Moment → Links → Article
loops using native document navigation. Retained official CommentWidget/SearchWidget
scripts require their full document lifecycle under the existing theme policy.
The recorded batch also keeps official SearchWidget 1.8.0 enabled: all 90
transition records identify its unmarked same-origin script as the native
lifecycle prerequisite. They do not also identify a CommentWidget script[src].
The coordinator locks the four content plugins above; it records the remaining
plugins and fails the native expectation when no matching official script is present.
Every transition records those scripts, a fresh main-frame document HTTP 200,
and disappearance of a newly set window sentinel. This is compatibility fallback
coverage, not a PJAX success or component-disposal claim. Assertions cover the retained MathML/TeX,
one math and code toolbar, picture semantics and one working lightbox, comment
subject identity and uniqueness in each new document, native link content, and English/Japanese/Korean
locale changes, including the Japanese/Korean browser message values. The five
loops use normal scoped links, not browser Back/Forward history. Links coverage
is native local-plugin data; it does not repeat remote-feed cancellation tests.
Every checkpoint records network errors and unfinished requests.
After all contexts and browsers close, a final gate rejects any page error,
console error, failed/unfinished request or HTTP error in the final arrays.
An earlier failure and its original stack are retained.
There are no navigation retries, plugin resource removal or keep-alive changes.

`--profile six-cases-attributed` is a separate fixed six-case acceptance batch
with the same five loops and strict error gates. It adds public observations for
all three engines: initial/link navigation intent, images before navigation,
images and completed image ResourceTiming entries after document readiness and
at checkpoints, plus context-close start/end timestamps. Pending requests are
captured before the checkpoint observation so extra observation time cannot turn
an overdue request into a passing checkpoint. Failures during teardown still fail.
The additional observations can affect scheduling and are not performance data.
Official `DEBUG=pw:protocol` output is stored in a new 0600 private file with
engine/case boundaries. It contains mixed protocols: extract the WebKit interval
as described in [DIAGNOSTICS.md](DIAGNOSTICS.md) before using its offline parser.
Only WebKit receives precise protocol loader attribution; public frame URLs and
DOM candidates do not provide that identity for Chromium or Firefox.

Output is a unique `combination-followup/<run-id>/` directory inside the lab.
`report.json` owns setup/restoration results; `browser-report.json` owns six
case results. `restore.private.json` is mode 0600 and must never be committed.
A setup failure, browser failure, incomplete case set or restoration failure is
a failed batch. Cleanup or restoration failure retains the ownership lock for
explicit inspection. Browser/context close is bounded at 10 seconds; the whole
browser batch has a fixed 1800-second limit, after which its dedicated process
group receives TERM then KILL before fixture restoration. Preserve raw output
and tool fingerprints before any correction.

The formula is generated by the locked official JAR's KaTeX renderer and saved
through Halo's API using the documented default-editor MathML parameters. This
is a saved-format control, not an editor UI roundtrip. Clipboard instrumentation
captures handler output, not the operating-system clipboard. This batch does
not cover comment submission/reply, plugin lifecycle, physical devices,
assistive technology, performance budgets or the full 1.0 contract. It cannot
reclassify previous network failures or revive deferred resource-lazy requirements.

## Separate WebKit cancellation diagnostic

Add `--profile webkit-dark-diagnostic` to the same owned-lab command to run one
WebKit dark case with the original five loops and strict error gates. The default
remains `six-cases`. This diagnostic does not replace or reclassify any earlier
acceptance batch. It adds before-click image snapshots, request frame/referrer
observations, and Playwright's official protocol logging into a new mode-0600
`protocol.private.log`; keep that raw log private in the ignored runtime.
Capture overhead may alter timing, so no performance conclusion is allowed.

See [DIAGNOSTICS.md](DIAGNOSTICS.md) for offline loader/document attribution and
its limits. Public frame URL/referrer and the stage label cannot establish request
ownership. Neither `cancelled` nor a still-current loader alone distinguishes
normal document departure from a genuine in-page failure.

## Official Halo 2.27.1 follow-up

Set `HALO_VERSION=2.27.1` for the lab, coordinator and performance station.
The lab defaults to 2.26.1 and accepts only pinned releases; each selected JAR
retains its real versioned filename and SHA-256. The combination browser also
checks the selected JAR bytes and live process identity. No connection flags
change. Use `--viewport desktop` for the separate 1440×1000 six-case batch;
the default remains 390×844. Both retain five loops, deadlines and strict
network gates. Desktop and mobile reports remain distinct, including failures.
The official-plugin versions are unchanged from the existing locks.
