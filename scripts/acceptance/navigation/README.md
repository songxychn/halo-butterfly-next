# Bounded core navigation acceptance

Run only after the comment and formula lanes finish, in an already-running,
task-owned Halo 2.26.1 instance. The coordinator must separately snapshot all
plugin names, creation timestamps, specs/configuration and JAR fingerprints,
disable every installed plugin and confirm DISABLED, then restore their exact
original enabled states/configuration after this runner finishes. This is an
explicit plugin-disabled configuration, not a claim that the enabled official
plugin ecosystem supports PJAX. The runner never changes a plugin or process.

```sh
python3 scripts/acceptance/navigation/run.py \
  --runtime "$PWD/.runtime/performance-followup/halo-lab" \
  --package "$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
  --package-sha256 93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --allow-synthetic-writes yes
```

For another fixed candidate, provide its full 40-character source commit and
explicit 64-character `--package-sha256`. Branch names, shortened SHAs and other
Git revision expressions are rejected before runtime access. Hex digits are
normalized to lowercase. Omitting `--package-sha256` preserves the original
`93b6a78a…` package default for existing commands; a new ZIP requires its own
explicit digest. The report records the declared source/package identity.

Preflight checks owned loopback process identity, the official Halo JAR, declared
candidate ZIP digest, matching installed source/hash, all 269 installed files,
no product source difference against the given commit,
all plugin states, active theme and operation locks. It preserves theme/system
configuration, plugin specs/configuration/JARs, existing Post/SinglePage specs
and published release-content fingerprints. A retained lock means restoration
or owned-fixture cleanup requires explicit inspection; do not delete it to rerun.

Three Chromium/Firefox/WebKit cases use 390px/light, once each. Three uniquely
labelled owned posts are created through public console/content APIs; their
actual published permalinks become stored reciprocal anchors. No links or
product code are injected into the browser. Each case performs five A→B→A
loops, one Back, one Forward and one excluded-target native transition: 12 PJAX
transitions plus one native transition, 14 content checkpoints including initial.

PJAX proof combines a persistent document sentinel, one actual target fetch,
no main-frame document request, correct URL/title/canonical and content, old DOM
disconnection, and the previous theme PageScope becoming inactive with zero
cleanup callbacks retained. Every checkpoint tests one code toolbar and one
working image lightbox with keyboard exit/focus restoration. The excluded path
must show a fresh document request and absent sentinel. Counter evidence is one
observed POST with current subject/URL and HTTP 200 per checkpoint, not a claim
about database balances, unique visitors or remote analytics delivery.

The initial load remains 20 seconds, navigation readiness 30 seconds, request
settling 5 seconds, context/browser close 10 seconds and the exclusive browser
process-group deadline 1800 seconds. Measurements are not retried. Network or
readiness failures remain failed evidence. Setup/publication/deletion polling
has fixed iteration bounds and uses the existing API client timeout; it is not
a performance measurement.

The runner restores its configuration changes, deletes only exact owned names,
labels, server creation timestamps and spec hashes, verifies full before/after
snapshots plus package/JAR bytes, then releases its lock. Plugin preparation and
restoration are separate coordinator evidence. A failed POST without a complete
registered identity retains the object/lock for inspection.

Reuse existing records without rerunning or changing their attribution:

- [Current official-plugin native navigation](../../../docs/validation/2026-10-17/combination-followup.md): six cases, 90 native transitions; SearchWidget 1.8.0's unmarked script is actually observed. This is not core PJAX.
- [Older real-Halo PJAX coverage](../../../docs/validation/2026-10-14/pjax-completion.md): historical content, tracker and draft-protection evidence only; its older package does not become this candidate's result.
- Existing `scripts/navigation-loading/check.mjs` synthetic exclude/error/race coverage is not a real-Halo acceptance result.

Comment drafts/submission/replies, plugin lifecycle, formula editor input,
physical devices/Safari, dark/desktop matrix, scroll restoration, remote SDKs,
performance and full 1.0 remain outside this lane. Official unknown scripts are
never removed or marked safe to force PJAX. This tool does not upgrade matrix
statuses or remove earlier failures.

## Diagnostic profile

`--profile chromium-diagnostic` runs the same fixed 14-checkpoint sequence once
only in Chromium. It adds read-only page-error stack, URL/stage/timestamp and
lightbox/PJAX lifecycle observations. It does not change keyboard or navigation
actions, readiness limits, assertions, product resources or connection options.
The three-engine run remains the default. Keep each failed run and its frozen
tools; a later diagnostic is separate evidence, never a replacement result.

The [2026-10-17 record](../../../docs/validation/2026-10-17/navigation-followup.md)
keeps the failed three-engine run and the subsequent single Chromium diagnostic
separate. Chromium's first frontend exception remains unresolved; a diagnostic
without reproduction does not turn the original matrix into a pass. Frozen
attempt01/attempt02 files and both raw runs are retained locally. Restoration
covers only the enumerated fields, not every database or notification object.

## Halo 2.27.1 history matrix

Use `HALO_VERSION=2.27.1 python3 scripts/acceptance/navigation/coordinate.py` with
`--runtime`, `--package`, `--source-sha`, and `--allow-synthetic-writes yes`.
The coordinator reserves the owned lab, records plugin identities/configuration,
disables them for the explicit core PJAX profile, then restores and verifies the
original states. It retains its lock on ambiguous restoration.

`--profile history-matrix` on the inner runner selects 3 engines × 390/1440px ×
light/dark. Each case retains five A/B loops, Back/Forward and one excluded native
navigation. Long saved content allows actual 850px/1250px scroll positions.
Keyboard activation of stored anchors preserves the source offset; before any
lightbox/focus checks, new PJAX destinations must reach 0 and Back/Forward must
restore the saved offset within 2px. The original readiness bounds are unchanged.
This does not certify native-history scroll under enabled official plugins or
physical Safari/mobile devices. Failures and cleanup evidence remain per-run.

`--profile history-webkit-followup` is the fixed two-case supplement (390/dark,
1440/light), with the same deadlines and explicit 100ms polling for new scroll/
ready assertions. It preserves the first matrix's two timeouts; a passing
supplement alone does not establish their root cause.

`--profile official-history` runs `native-history.mjs` with the original official
plugins enabled. Its 12 cases check A→B→Back(A at 850px)→Forward(B at 1250px)→a new
A entry at 0px. Document requests prove native navigation; a no-request restoration
would require both a known document ID and `pageshow.persisted`. This is separate
from core PJAX disposal/counter checks.

A direct runner refuses every active runtime lock. Only a core child with an
exact `--coordinator-run-id` matching all three runtime reservation files and
the shared CPU owner may enter the reserved lab. The coordinator holds the
existing combination/fault and performance CPU locks through full plugin
restoration, so older entry points cannot enter during that window.

The final Halo 2.27.1 follow-up includes a product fix for deferred Prism layout
changing restored scroll offsets. Native WebKit and theme-owned manual/PJAX
restoration are separate branches. `native-history.mjs` observes the real saved
positions without injecting scroll state or changing plugin scripts; its fixed
WebKit diagnostic profile additionally records read-only layout/scroll events.
All failed product candidates and passing replacements retain separate source,
ZIP and report identities in the [2026-10-25 evidence](../../../docs/validation/2026-10-25/user-flows.md).

## Review-strengthened gates

Core history checks the expected offset only after the code toolbar, image and
bounded network idle have settled, before lightbox focus can move the viewport.
Both runners keep request/page/console listeners through context/browser close
and validate the final arrays afterwards; late failures cannot retain a pass.
The [PR #429 review record](../../../docs/validation/2026-10-25/pr429-review.md)
attributes new strict batches separately from the original reports.
