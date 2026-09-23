import { boundedError } from './support.mjs';

const abortReasons = new Set(['NS_BINDING_ABORTED', 'net::ERR_ABORTED', 'cancelled']);
const resourceTypes = new Set(['stylesheet', 'script', 'image', 'font', 'media']);

// Object identities, not report fields or URL matching, establish which request
// the runner interrupted. A URL is used only to require a completed replacement.
export function observeReloadRequests(page, result) {
  const startsFromBlank = page.url() === 'about:blank';
  const requests = new Map(), failures = new Map(), captureErrors = new Map();
  let documentId = 0, committedDocumentId = 0, nextId = 0, activeReload;
  const reloads = [];
  result.runnerCancellations = [];
  result.runnerReloads = [];
  page.on('request', request => {
    let mainFrame = false;
    try { mainFrame = request.frame() === page.mainFrame(); } catch { /* Workers have no frame; never eligible. */ }
    if (mainFrame && request.isNavigationRequest()) documentId++;
    requests.set(request, { request, id: ++nextId, documentId: mainFrame && request.isNavigationRequest() ? documentId : committedDocumentId, mainFrame, initialParserRequest: startsFromBlank && documentId === 1 && committedDocumentId === 0 && mainFrame && !request.isNavigationRequest(), finished: false });
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      // Playwright may deliver parser resource requests before the first commit
      // event. Only the observed first navigation out of about:blank is safe to
      // attribute this way; later pre-commit resources stay in the old document.
      if (startsFromBlank && committedDocumentId === 0 && documentId === 1) {
        for (const state of requests.values()) if (state.initialParserRequest) state.documentId = 1;
      }
      committedDocumentId = documentId;
    }
    if (frame === page.mainFrame() && activeReload) {
      activeReload.committed = true;
      activeReload.documentId = documentId;
    }
  });
  page.on('requestfinished', request => {
    const state = requests.get(request);
    if (state) state.finished = true;
  });
  page.on('requestfailed', request => {
    const state = requests.get(request);
    const failure = { requestId: state?.id, url: request.url(), method: request.method(), reason: request.failure()?.errorText };
    result.requestFailures.push(failure);
    failures.set(request, failure);
    if (state) {
      state.failed = true;
      if (activeReload && !activeReload.committed && activeReload.oldRequests.has(request) && abortReasons.has(failure.reason)) state.cancelledBy = activeReload;
    }
  });
  return {
    pendingRequests() {
      // Completion is broader than reload eligibility: child-frame assets and
      // documents must finish too. Background fetch/XHR, streams and the allowed
      // counter POST have no new completion requirement; their errors still fail.
      return [...requests.values()]
        .filter(state => !state.finished && !state.failed && ['GET', 'HEAD'].includes(state.request.method()) && (state.request.resourceType() === 'document' || resourceTypes.has(state.request.resourceType())))
        .map(state => ({ requestId: state.id, url: state.request.url(), method: state.request.method(), type: state.request.resourceType(), documentId: state.documentId, mainFrame: state.mainFrame, responseReceived: !!state.item }));
    },
    async reload(operation) {
      if (activeReload) throw new Error('Nested runner reload');
      const reload = { id: reloads.length + 1, committed: false, successful: false, targetUrl: page.url(), oldDocumentId: committedDocumentId, oldRequests: new Set() };
      for (const [request, state] of requests) {
        if (state.documentId === committedDocumentId && state.mainFrame && !state.finished && !state.failed && !request.isNavigationRequest() && ['GET', 'HEAD'].includes(request.method()) && resourceTypes.has(request.resourceType())) reload.oldRequests.add(request);
      }
      reloads.push(reload); activeReload = reload;
      const record = { id: reload.id, result: 'pending' }; result.runnerReloads.push(record);
      try {
        const response = await operation();
        reload.successful = reload.committed && reload.documentId > reload.oldDocumentId && response?.status() === 200 && !response.request().redirectedFrom() && response.url() === reload.targetUrl && page.url() === reload.targetUrl && requests.get(response.request())?.documentId === reload.documentId;
        record.result = reload.successful ? 'completed' : 'unconfirmed';
        return response;
      } catch (error) { record.result = 'failed'; throw error; }
      finally { activeReload = undefined; }
    },
    response(request, item) {
      const state = requests.get(request);
      if (state) { state.item = item; item.requestId = state.id; }
    },
    bodyComplete(request) {
      const state = requests.get(request);
      if (state) state.bodyComplete = true;
    },
    captureError(request, item, error) {
      const message = boundedError(error);
      item.captureError ??= message;
      (item.captureErrors ??= []).push(message);
      const state = requests.get(request);
      const reload = state?.cancelledBy || (activeReload && !activeReload.committed && activeReload.oldRequests.has(request) ? activeReload : undefined);
      if (!captureErrors.has(request)) captureErrors.set(request, []);
      captureErrors.get(request).push({ item, reload });
    },
    exemptions() {
      const requestFailures = new Set(), resourceCaptureErrors = new Set();
      result.runnerCancellations = [];
      for (const [request, state] of requests) {
        const reload = state.cancelledBy;
        if (!reload?.successful || state.item?.failure || (captureErrors.has(request) && captureErrors.get(request).some(capture => capture.reload !== reload))) continue;
        const replacement = [...requests.values()].find(next => next.request !== request && next.documentId === reload.documentId && next.mainFrame && next.finished && !next.failed && next.item?.status === 200 && !next.item.failure && !next.item.captureError && next.bodyComplete && next.request.url() === request.url() && next.request.method() === request.method() && next.request.resourceType() === request.resourceType());
        if (!replacement) continue;
        const failure = failures.get(request);
        requestFailures.add(failure);
        for (const capture of captureErrors.get(request) || []) resourceCaptureErrors.add(capture.item);
        result.runnerCancellations.push({ reloadId: reload.id, requestId: state.id, replacementRequestId: replacement.id, url: request.url(), reason: failure.reason, responseBodyCancelled: captureErrors.has(request) });
      }
      return { requestFailures, resourceCaptureErrors };
    }
  };
}
