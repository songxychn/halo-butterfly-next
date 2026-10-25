# Real official comment usage acceptance

Runs only against an already running, explicitly owned loopback lab. It does not
start/stop servers, install software, change product code, patch official modules,
rewrite official POST bodies, or apply a connection workaround.

Preflight binds the source commit, installed ZIP's 269 files, official Halo JAR,
CommentWidget 3.3.2 JAR, all plugin/config identities, and original published
Post/SinglePage release content. Only the synthetic `.invalid` maintainer account
and anonymous `.invalid` addresses are used. SMTP must already have no host and
be disabled: the official `allowNotification: true` payload is kept intact.
External browser HTTP requests are blocked and fail the case.

The fixed usage matrix is Chromium/Firefox/WebKit × anonymous mobile390 and
signed-in desktop1440. Each case uses the real official forms to check:

1. Draft storage, native `beforeunload` dismissal, accepted leave, and restoration.
2. One actual parent-comment submission, official response200, editor/draft reset.
3. One explicit reply503, retained editor and draft, then one actual UI retry200.
4. Refresh with exactly one parent and one reply.

After all six pass, one official plugin disable/enable cycle is checked in three
fresh browser engines for fallback and restored comments. This is native browser
navigation, not PJAX acceptance. Captcha, private comments, uploads, moderation,
mail delivery, other providers and physical devices remain outside this batch.

Python owns the single API session, strict generated fixtures, bounded browser
process groups and final cleanup/restore. UI-created children are attributable
through their random owned subject, run-specific raw text and server creation
timestamps. Related new local notification/subscription records are cleaned;
pre-existing notifications are never selected. Failure records are retained and
no browser case is retried. A failed cleanup or restoration retains the lock.
Private cookies are removed at completion; private restore snapshots stay local.

```sh
python3 scripts/acceptance/comments/run.py \
  --runtime .runtime/performance-followup/halo-lab \
  --package .runtime/performance-followup/evidence/candidate-d678d3f.zip \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --allow-synthetic-writes yes
```

Use only after independent review and an exclusive lab window are confirmed.

The first historical batch miscompared official rich-text draft HTML with plain
text and also retained one Firefox anonymous document-readiness timeout. The
`--cases corrected-five` profile fixes only the HTML contract and excludes that
Firefox anonymous connection failure; it does not claim six-case acceptance.
Browser limits stay unchanged. The actual editor HTML, visible text, draft,
official payload and returned raw HTML are compared without rewriting content.

All notification objects are retained in private before/after snapshots. Halo's
PostReconciler calls DefaultNotificationCenter.subscribe, which removes/recreates
the author's global subscription and token. Only the exact enabled
`fixture-maintainer` / `new-comment-on-post` / `props.postOwner == 'fixture-maintainer'`
subscription with the official NonexistentKind subject permits semantic equality;
name, creation timestamp and token hash are recorded separately, never described
as identity restoration. Every other pre-existing notification/reason/subscription
still uses exact identity/spec equality. Fixed 30-second readiness waits observe
known login reason and deletion convergence before snapshots; they do not retry
browser cases. Old failed batch reports are not overwritten or reclassified.

`--cases reply-three` is the further fixed correction for the three cases that
reached reply503: Chromium anonymous/signed-in and Firefox signed-in. It matches
the official exact `title + " - " + detail` toast. The two WebKit empty-editor
observations remain separate failed evidence pending diagnosis; this profile does
not replace them. All original timeouts and official request bodies stay intact.

`--cases webkit-two` is a separate two-case supplement using real key events
(`click` then `pressSequentially`) for contenteditable text. A preceding single
read-only local-draft diagnostic found unchanged editor node identity but empty
DOM, official editor model and draft after WebKit's `fill` returned. That diagnostic
retains its later anonymous-name-locator failure (only 2 of 8 planned snapshots),
so it does not claim a complete timing diagnosis or an upstream bug. The supplement
checks an initialized empty editor, actual visible text/HTML, official editor text,
and the same 20-second draft gate. It never injects editor state or rewrites POSTs.

`--cases lifecycle-only` creates one parent and reply via the official public API
as explicitly labelled reading fixtures, then runs only the existing three-engine
disabled/restored stages. It never counts these seed requests as UI submission,
retry or draft acceptance. This independent phase avoids repeating prior usage
cases whose functional checkpoints completed but whose strict network gates
retained failures. WebKit's navigation-time font cancellation is not classified
as a proven Halo connection-read defect; Firefox's two network observations stay
separate. Every fixture still follows the same strict cleanup and restoration.

## Halo 2.27.1 user-flow follow-up

Set `HALO_VERSION=2.27.1` to bind the pinned official JAR; the default historical
pin remains available. `--subject Post|SinglePage|Moment` selects one independently
owned fixture and six engine/identity cases. Moment uses its native subject group,
resource collection and template, with the same comment/reply form assertions.
Every run freezes its Python/JS tools before writing fixtures.

Submissions are paced 6500ms each to stay within the official 10/minute creation
budget; no server rate-limit setting is changed and no rejected POST is retried
except the one declared client-injected 503. Leaving uses keyboard activation of
the saved anchor, avoiding Playwright click's implicit scroll. The return starts
only after the away document's bounded readiness check. Historical failed runs
remain separate; this is neither a network-cancellation exemption nor a claim of
pointer-path or real-device acceptance.

Moment creation waits for the official `approvedTime` reconciliation before
freezing its spec. For the selected subject only, the exact synthetic maintainer's
`new-comment-on-moment` or `new-comment-on-single-page` subscription permits the
same narrowly checked token/identity rotation as the existing Post subscription.
No other subscriber, expression, reason type or extra spec shape is exempted.
Restored reading expands existing replies; it does not require a reply editor.
