/** A native fragment link remains usable when scripts are disabled. */
export function bindCommentJump(root: Document = document) {
  const target = root.getElementById('post-comment');
  const heading = root.getElementById('comment-title');
  const win = root.defaultView;
  if (!target || !heading || !win) return;
  if (target.dataset.commentJumpBound === 'true') return;
  target.dataset.commentJumpBound = 'true';
  const focus = () => {
    if (win.location.hash !== '#post-comment') return;
    heading.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  // All same-document comment links (including existing metadata counts).
  root.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== win.location.origin || url.pathname !== win.location.pathname || url.search !== win.location.search || url.hash !== '#post-comment') return;
    event.preventDefault();
    const hiddenGroup = link.closest<HTMLElement>('#rightside-config-hide');
    if (hiddenGroup) {
      hiddenGroup.classList.remove('show');
      hiddenGroup.inert = true;
      root.getElementById('rightside-config')?.setAttribute('aria-expanded', 'false');
    }
    if (win.location.hash !== '#post-comment') win.history.pushState(win.history.state, '', url.pathname + url.search + url.hash);
    focus();
  });
  const followNavigation = () => {
    focus();
    // History traversal can restore focus/scroll after dispatching popstate.
    // Reapply after that browser restoration, still guarded by the current hash.
    win.requestAnimationFrame(focus);
  };
  win.addEventListener('hashchange', followNavigation);
  win.addEventListener('popstate', followNavigation);
  win.addEventListener('load', focus, { once: true });
  focus();
}
