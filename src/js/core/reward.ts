/**
 * 打赏。对齐 Butterfly 5.7.0
 * _config.yml reward + layout/includes/post/reward.pug + layout/post.pug
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：enable false、text 空、QR_code 空。
 * post.pug 条件为 enable && QR_code；仅显式 true 开启。
 * 空 text 回退「打赏」（上游 _p('donate')）。
 * 仅文章页；单页 page.html 不插入。
 * 不做 footer、related_post helper、逐页覆盖。
 */

export const DEFAULTS = {
  enable: false,
  text: '',
  QR_code: [],
};

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 false；仅显式 true 开启。 */
export function resolveEnable(value: unknown) {
  return isExplicitTrue(value);
}

/** 空 / 缺省回退「打赏」。 */
export function resolveText(value: unknown) {
  if (value == null) return '打赏';
  const text = String(value);
  return text.trim() === '' ? '打赏' : text;
}

export function resolveClickTo(item: {link?: unknown; img?: unknown} | null | undefined) {
  if (!item || typeof item !== 'object') return '';
  const link = item.link == null ? '' : String(item.link);
  if (link.trim() !== '') return link;
  return item.img == null ? '' : String(item.img);
}

/** 对齐 post.pug `enable && QR_code`：开启且至少一项有 img。 */
export function shouldRender(enable: unknown, items: unknown) {
  if (!resolveEnable(enable)) return false;
  return visibleQrItems(items).length > 0;
}

export function visibleQrItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && String(item.img ?? '').trim() !== '');
}

const boundRewards = new WeakMap<HTMLElement, () => void>();

/** Native disclosure: click/Enter/Space pin it open; mouse hover is temporary.
 * Escape/close return focus to the trigger; outside pointer/focus dismissal
 * leaves the user's new target alone. No focus trap for this non-modal panel.
 */
export function bindReward(root: HTMLElement) {
  const existing = boundRewards.get(root);
  if (existing) return existing;
  const button = root.querySelector<HTMLButtonElement>('.reward-button');
  const panel = root.querySelector<HTMLElement>('.reward-main');
  const closeButton = root.querySelector<HTMLButtonElement>('.reward-close');
  if (!button || !panel || !closeButton) return () => {};
  const doc = root.ownerDocument;
  let pinned = false;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  const clearLeave = () => clearTimeout(leaveTimer);
  const show = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && doc.defaultView) {
      const rect = button.getBoundingClientRect();
      const above = Math.max(0, rect.top - 20);
      const below = Math.max(0, doc.defaultView.innerHeight - rect.bottom - 20);
      const placeAbove = above >= below;
      panel.setAttribute('data-placement', placeAbove ? 'above' : 'below');
      panel.style.setProperty('--reward-max-height', `${Math.max(48, (placeAbove ? above : below) - 15)}px`);
    }
  };
  const close = (restore = false) => {
    clearLeave();
    pinned = false;
    show(false);
    if (restore) button.focus();
  };
  const toggle = () => {
    clearLeave();
    if (pinned) close(true);
    else { pinned = true; show(true); }
  };
  const onEnter = (event: PointerEvent) => {
    clearLeave();
    if (event.pointerType === 'mouse') show(true);
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearLeave();
    leaveTimer = setTimeout(() => {
      if (!pinned && !root.contains(doc.activeElement)) close();
    }, 120);
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close(pinned || root.contains(doc.activeElement));
  };
  const onOutside = (event: PointerEvent) => {
    if (event.target instanceof Node && !root.contains(event.target)) close();
  };
  const onFocusOut = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) close();
  };
  const onClose = () => close(true);
  const onResize = () => close(panel.contains(doc.activeElement));
  root.setAttribute('data-reward-bound', 'true');
  show(false);
  button.addEventListener('click', toggle);
  closeButton.addEventListener('click', onClose);
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  doc.addEventListener('keydown', onEscape);
  root.addEventListener('focusout', onFocusOut);
  doc.addEventListener('pointerdown', onOutside);
  doc.defaultView?.addEventListener('resize', onResize);
  const imageCleanups = [...panel.querySelectorAll<HTMLImageElement>('img.post-qr-code-img')].map(img => {
    const onError = () => {
      img.hidden = true;
      const message = img.nextElementSibling;
      if (message instanceof HTMLElement) message.hidden = false;
    };
    img.addEventListener('error', onError);
    if (img.complete && img.naturalWidth === 0) onError();
    return () => img.removeEventListener('error', onError);
  });
  const cleanup = () => {
    close();
    button.removeEventListener('click', toggle);
    closeButton.removeEventListener('click', onClose);
    root.removeEventListener('pointerenter', onEnter);
    root.removeEventListener('pointerleave', onLeave);
    doc.removeEventListener('keydown', onEscape);
    root.removeEventListener('focusout', onFocusOut);
    doc.removeEventListener('pointerdown', onOutside);
    doc.defaultView?.removeEventListener('resize', onResize);
    imageCleanups.forEach(fn => fn());
    root.removeAttribute('data-reward-bound');
    panel.hidden = false;
    boundRewards.delete(root);
  };
  boundRewards.set(root, cleanup);
  return cleanup;
}

export function bindRewards(root: Document | Element = document) {
  return [...root.querySelectorAll<HTMLElement>('.post-reward')].map(bindReward);
}
