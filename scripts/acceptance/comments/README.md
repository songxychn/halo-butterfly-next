# Official comment acceptance tools

Current maintenance scope follows [DEC-09](../../../docs/parity/DEC-09-RELEASE-CLOSURE.md). Existing modes document historical evidence and are not a release checklist. Do not start further plugin-business matrices. Only the already running natural observation is authorized to continue; preserve ownership guards and cleanup.


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

## Existing supplemental modes

`corrected-five`, `reply-three`, `webkit-two`, `firefox-signed` and
`lifecycle-only` retain their original bounded scopes; they must not be combined
into a claim that an original failed batch passed. The fixed historical mode
semantics, input corrections and subscription-rotation rules are available in the
[pre-cleanup README](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/scripts/acceptance/comments/README.md). No notification ownership or restoration guard is
removed by this documentation cleanup.

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

## Bounded policy, access and language matrices

`--cases policy-only` separately checks the official global/subject visibility,
member-only form behavior, real moderation/private submissions, captcha surface,
and disabled upload/emoji configuration. It does not solve captchas or upload
attachments. `--cases lifecycle-only --lifecycle-pairs 6` uses six API-created
reading fixtures; these are never counted as UI submissions.

`--cases access-only` applies only to Post/SinglePage. It checks anonymous and
owner HTTP/API reads through PUBLIC, INTERNAL, PRIVATE and restored PUBLIC.
INTERNAL is not interpreted as readable by every signed-in user. The native
SinglePage detail API's empty HTTP200 denial is accepted only at its exact URL
with a zero-byte body; HTML detail still requires denial.

`--cases language-only` reuses the owned Post/SinglePage and restoration guards.
Nine HTTP scenes check body/UI separation, query/cookie/site priority and locale
fallback. Three scenes each run three headless engines at 390/1440 widths and
assert browser UI messages. The declared site locale is zh-CN; other site setups
fail preflight instead of changing the expected result. Original annotations are
restored before the owned subject is deleted. This is not native-speaker review,
actual Safari or author-forced whole-page UI language support.

All these modes retain failed reports and exact source/package/JAR binding.
Choose one exclusive runtime window; do not overlap a performance measurement.

## Image upload and owned attachment cleanup

`--cases upload-only` declares six cases (three engines × anonymous/signed in)
for the selected Post/SinglePage/Moment. It selects real files through the upload
button, checks local format/size rejection, reloads an unsubmitted image draft,
injects one upload 503, retries through the actual form, submits a parent and
reply with images, and checks both images again after a full refresh.
`--cases upload-direct` is a separate six-case scope without the unsubmitted-image
refresh; it cannot turn a failed draft-recovery case into a pass.
`--cases upload-webkit-direct` declares only the two WebKit identities as a
separate supplement. It cannot replace a failed six-case report.
`--cases upload-isolated` uses two WebKit identities and serves only the original
official component script on an intercepted synthetic subject document, with no
theme CSS/JS; it provides attribution, not theme integration acceptance.

The harness uses an exclusive owned-lab lock, checks the exact installed ZIP and
official JARs, leaves SMTP disabled, and creates a unique local attachment group.
It records all successful upload IDs and submission ticket IDs, including an
unused ticket left by a failed UI submission. Cleanup checks IDs, creation times,
filenames, group, upload labels, comment targets and the pre-run inventory; it
restores plugin settings and compares the original storage inventory. Failed
restoration retains the runtime lock for inspection.

For images bound to deleted comments/replies, it first observes the official
one-hour `delete-after` schedule. It then advances only those owned fixture
annotations to a past time and observes the official reconciler remove the
attachment and the public image return 404. This is controlled-deadline evidence,
not a naturally elapsed hour. On a failed run, a temporary owned upload can be
expired using the same explicit fixture-only method. Natural 24-hour expiry and
other storage providers remain outside this batch. The 30-second observation
window after advancing an annotation is a harness deadline, not the official
natural GC deadline. A timeout stays failed and locked; any later administrative
recovery must be recorded separately, never substituted for official GC proof.

WebKit uses a fresh private disk profile per case and removes it after closing.
The input harness waits for the official editor click handler's 100ms delayed
focus before switching fields, uses real Tab/typing for anonymous WebKit input,
and asserts visible and submitted text. Pointer interception failures remain
separate from keyboard-input supplements.
The one-off IndexedDB and multipart diagnostic entry points are retired.
Their [recorded results](../../../docs/validation/2026-10-27/webkit-file-transport.md)
and frozen source references remain available; no diagnostic command is part of
the current release workflow.

## Natural-time lifecycle follow-up

`--cases upload-natural --subject Post` creates four official local-storage API
fixtures: a bound parent image, a bound reply image, a bound image also referenced
by another comment, and an unsubmitted temporary upload. These are lifecycle
fixtures, not UI-submission evidence. The reference holder is an explicitly
recorded administrative content edit; it does not bypass the public upload API
in a claimed user flow. The observer retains the existing exclusive lab lock
for about 24 hours and records one sample per minute.

No expiry/deletion timestamp, server clock, official plugin or JAR is modified.
The normal bound-image grace is five minutes after the official deadline. The
reference holder stays until twenty minutes after that deadline, then the tool
deletes only its owned holder and permits the documented fifteen-minute retry
plus sampling allowance. Temporary expiry allows two fifteen-minute reconciler
periods plus two minutes. These bounds are fixed before observing results.
Original errors remain failed; a gap over 120 seconds invalidates continuous
observation. Failed live attachments remain locked for separately reviewed
recovery rather than being forcibly expired.

Halo 2.27.1 re-approves a parent when a comment manager replies. The fixture
validates only the resulting `approvedTime` change within that owned API request
window before registering the full resource snapshot. Content, owner, subject
and creation identity changes still fail the guard. Final cleanup verifies the
original storage, plugin config, theme config, content and package identities.

The existing worker keeps its frozen tool sources. Do not start another batch,
change deadlines, restart services or occupy its locked runtime. Tracked-source
cleanup does not hot-patch that worker. The already running observation finishes
with its original cleanup and restore checks, then its heartbeat is removed.
