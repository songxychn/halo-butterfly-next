# Default-editor KaTeX acceptance

Run only against the already-running owned loopback lab, with no other writer.
The coordinator does not bootstrap, restart, patch or tune Halo. The initial
station must have the official hybrid editor 1.7.0, no KaTeX plugin, and no
KaTeX ConfigMap/Setting. Supply the pinned official KaTeX 3.0.0 JAR, SHA256
`e444781b99c23b020fcc379f6859ce67dc7669536c880004f7bf7cce0ed2df96`.

```sh
python3 scripts/acceptance/math-editor/run.py \
  --runtime .runtime/authored-images/halo-lab \
  --package .runtime/performance-followup/evidence/candidate-d678d3f.zip \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --plugin .runtime/performance-followup/plugin-downloads/plugin-katex-3.0.0.jar \
  --allow-synthetic-writes yes
```

The current fixed author matrix is Chromium/Firefox × inline/block formula,
four separate Posts. Prior six-case plans remain separate: an earlier three-engine batch
failed four actual saves and then timed out at WebKit login. That login failure
is unresolved and WebKit is not launched or retested by this version. It uses the official slash commands `KaTeX 行内公式` and
`KaTeX 块级公式`, then the plugin's actual CodeMirror controls. All author
mutations use UI and native keyboard input. CodeMirror state is read only through the official, already-loaded
`EditorView.findFromDOM` module for evidence and readiness; no renderer, editor transaction, paste event, or DOM
content injection supplies the formulas. Each case saves once, reloads and
reads the formula, changes its TeX from the first fixed formula to the second,
saves again, and reloads to read the changed CodeMirror source. The current
scope omits a separate second-edit body nonce: earlier marker-related tool
failures remain in their original reports. The initial unique run/body text
must remain in saved requests, stored snapshots, reopened editors and reader
pages. Exact second TeX in requests, snapshots and published MathML proves
the formula edit. Publishing is explicitly an official API action. The official editor emits parent content after a 250ms debounce; its
PostEditor then persists parent raw content in `post-content-cache` through
a 500ms debounce. Before each save this runner waits, within the existing
20s limit, for that exact draft name (empty only for a new unsaved route),
unique body and exact formula annotation. It only
reads the cache, archives the matching row, and requires the actual submitted
raw/HTML to equal it. No fixed sleep or synthetic cache write makes content
ready. Saved requests, stored head snapshots, and editor-only DOM remain the
acceptance evidence; cache readiness does not substitute for a real save.

The four resulting articles are then checked in four serial states: normal,
theme display off, plugin disabled with theme on, and plugin re-enabled.
Every case uses a new anonymous context, preserves initial HTML, reads the
MathML namespace and exact TeX annotation, and checks the visible formula or
source fallback. `math.copy_tex` stays on: the existing theme supports copying
when formula display is off, and supports annotations in saved MathML while
the plugin is disabled. Copy assertions capture the installed click handler's
output; they do not claim operating-system clipboard integration. Plugin
frontend rendering stays disabled throughout. There is no automatic retry of
a failed author or reader case.

Before mutation, the coordinator verifies the owned process, official Halo
2.26.1 JAR, all 269 installed theme files, and the plugin JAR inventory. It
records theme and system configuration digests, existing plugin spec/config
digests, existing Post/SinglePage specs, and each published release-content
response digest. Each UI-created Post is bound to the server-generated random
name, exact unique title, server creation timestamp, owner and latest confirmed
spec digest. UID is checked only if supplied. Unknown successful mutations
are not silently adopted for deletion.

The coordinator's `finally` removes registered fixtures, uninstalls only its
newly installed plugin instance, removes only identified new auxiliary
resources, restores the complete theme configuration, and reads back the
listed theme/system/plugin configuration, existing Post/SinglePage specs and
published release-content digests, plus JAR/package identity. This does not
claim every runtime resource is restored: official notification subscriptions
may rotate when publishing; the runner does not overwrite their tokens. A recovery ambiguity or
failure retains the ownership lock. The private recovery snapshot is mode
0600 and must not be committed. Browser child processes have one total 1800s
matrix deadline; UI readiness and individual requests keep a 20s bound.
Timed-out process groups are terminated before cleanup begins.

Output is a new `math-editor-followup/<run-id>/` directory inside the lab.
`report.json` owns setup, lifecycle and restoration; `author.json` owns the four
author cases; the four named reader JSON reports own their four cases each.
Preserve every failed run and frozen tool SHA before correcting a tool. Raw
content, private snapshots and JARs remain local; committed reports contain
only scoped summaries and evidence hashes. This is not full PLG-06/EXT-02,
other-editor, physical-device, assistive-technology or performance acceptance.

## Halo 2.27.1 supplement

With `HALO_VERSION=2.27.1`, the coordinator binds the official JAR including its
bundled default editor (the old hybrid plugin requirement applies only to the
historical Halo pin). `--engines webkit` explicitly selects two author cases and
eight readings in four states. The pinned CodeMirror module comes from that JAR;
its `EditorView.findFromDOM` export is still read only.

The pinned official KaTeX 3.0.0 may already be installed. In that case preserve its
instance/configuration and restore its original enabled state; never uninstall an
existing plugin. The absent-plugin path retains the original owned install and
uninstall workflow. All runs freeze tool copies and use bounded owned-process
cleanup. Actual results, including any official UI changes, belong to each run.
