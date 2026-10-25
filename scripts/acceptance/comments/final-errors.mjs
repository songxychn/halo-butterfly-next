/** Evaluate the final arrays after all contexts and browsers have closed. */
export function finalCommentErrors(row) {
  const requests=row.requests||[];
  const injected=requests.filter(r=>r.expectedInjected503===true&&r.method==='POST'&&r.status===503&&/\/apis\/api.halo.run\/v1alpha1\/comments\/[^/]+\/reply$/.test(new URL(r.url).pathname));
  const expectedConsole='Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
  const console=row.consoleErrors||[];
  return {
    requests:requests.filter(r=>r.state!=='finished'||(r.status>=400&&!injected.includes(r))),
    page:row.pageErrors||[],
    console:console.filter(m=>m!==expectedConsole),
    excessInjectedConsole:Math.max(0,console.filter(m=>m===expectedConsole).length-injected.length),
    external:row.externalBlocked||[],
    writes:row.unexpectedWrites||[],
    close:row.closeError||null,
  };
}

export function hasFinalCommentErrors(errors) {
  return Object.values(errors).some(value=>Array.isArray(value)?value.length>0:!!value);
}
