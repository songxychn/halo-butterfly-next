import { onPageCleanup } from './page-lifecycle.ts';

const positions = new Set(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']);
export function snackbarPosition(value: unknown) {
  return typeof value === 'string' && positions.has(value) ? value : 'bottom-left';
}
export default class Message {
  #container: HTMLDivElement | null = null;
  #timers = new Set<ReturnType<typeof setTimeout>>();
  constructor() {
    onPageCleanup(() => { this.#timers.forEach(clearTimeout); this.#timers.clear(); this.#container?.remove(); });
  }
  #show(type: 'info' | 'error', text: string, duration = 3000) {
    const conf = MainApp.conf;
    const snackbar = conf.snackbar_enable === true || conf.snackbar_enable === 'true';
    if (!this.#container) {
      this.#container = document.createElement('div');
      this.#container.className = 'theme-notices';
      this.#container.dataset.position = snackbar ? snackbarPosition(conf.snackbar_position) : 'top-center';
      for (const [variable, value] of [['--notice-light', conf.snackbar_bg_light], ['--notice-dark', conf.snackbar_bg_dark]]) {
        if (value && CSS.supports('color', value)) this.#container.style.setProperty(variable!, value);
      }
      this.#container.setAttribute('aria-live', 'polite');
      this.#container.setAttribute('aria-relevant', 'additions');
      document.body.append(this.#container);
    }
    const notice = document.createElement('div');
    notice.className = `theme-notice ${type}`;
    notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const message = document.createElement('span');
    message.textContent = text;
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '关闭'; close.setAttribute('aria-label', '关闭提示');
    notice.append(message, close); this.#container.append(notice);
    // Keep a burst of events bounded, without concatenating untrusted HTML.
    while (this.#container.children.length > 3) this.#container.firstElementChild?.remove();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { if (timer !== undefined) { clearTimeout(timer); this.#timers.delete(timer); } };
    const remove = () => { cancel(); notice.remove(); };
    const schedule = () => {
      cancel();
      timer = setTimeout(() => { if (timer !== undefined) this.#timers.delete(timer); notice.remove(); }, Math.max(1000, Math.min(Number.isFinite(duration) ? duration : 3000, 30000)));
      this.#timers.add(timer);
    };
    close.addEventListener('click', remove);
    notice.addEventListener('pointerenter', cancel); notice.addEventListener('pointerleave', schedule);
    notice.addEventListener('focusin', cancel); notice.addEventListener('focusout', schedule);
    schedule();
  }
  info(message: string, duration?: number) { this.#show('info', message, duration); }
  error(message: string, duration?: number) { this.#show('error', message, duration); }
}
