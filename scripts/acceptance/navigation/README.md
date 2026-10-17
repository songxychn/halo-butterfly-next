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
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --allow-synthetic-writes yes
```

Preflight checks owned loopback process identity, the official Halo JAR, fixed
candidate ZIP `93b6a78a…`, all 269 installed files, no product source difference,
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
