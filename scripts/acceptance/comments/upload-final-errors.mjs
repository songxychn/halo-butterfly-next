/** Keep the one explicitly injected upload failure separate from unexpected network errors. */
export function finalUploadErrors(row) {
 const injected=(row.requests||[]).filter(r=>r.expectedInjected503===true&&r.method==='POST'&&r.status===503&&new URL(r.url).pathname==='/apis/api.commentwidget.halo.run/v1alpha1/upload');
 const expectedConsole='Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
 const console=row.consoleErrors||[];
 return {
  requests:(row.requests||[]).filter(r=>r.state!=='finished'||(r.status>=400&&!injected.includes(r))),
  page:row.pageErrors||[],console:console.filter(x=>x!==expectedConsole),
  excessInjectedConsole:Math.max(0,console.filter(x=>x===expectedConsole).length-injected.length),
  excessInjectedRequests:Math.max(0,injected.length-1),close:row.closeError||null,
 };
}
