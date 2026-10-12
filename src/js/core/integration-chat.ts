import {enabled, text} from './external-resource.ts';
import type {ScriptLoader} from './integrations.ts';

interface TidioApi {open(): void; close(): void; show(): void; hide(): void; on(event: string, handler: () => void): void}
type ChatraApi = ((...args: unknown[]) => void) & {q?: unknown[][]};
interface CrispApi {push(args: unknown[]): unknown; is?: (state: string) => boolean}
export interface IntegrationWindow extends Window {
  ChatraID?: string; Chatra?: ChatraApi; ChatraSetup?: Record<string, unknown>;
  CRISP_WEBSITE_ID?: string; $crisp?: CrispApi; tidioChatApi?: TidioApi;
}
export interface ChatConfig {
  use?: unknown; rightside_button?: unknown; button_hide_show?: unknown;
  chatra?: {id?: unknown}; tidio?: {public_key?: unknown}; crisp?: {website_id?: unknown}; knocket?: {identifier?: unknown};
}

export function chatPlan(config: ChatConfig) {
  const use = text(config.use);
  const id = text(use === 'chatra' ? config.chatra?.id : use === 'tidio' ? config.tidio?.public_key
    : use === 'crisp' ? config.crisp?.website_id : use === 'knocket' ? config.knocket?.identifier : '');
  if (!id || !/^[a-z\d_-]{1,128}$/i.test(id)) return null;
  const urls: Record<string, string> = {
    chatra: 'https://call.chatra.io/chatra.js', tidio: `https://code.tidio.co/${id}.js`,
    crisp: 'https://client.crisp.chat/l.js', knocket: `https://trtc.io/knocket-sdk/sdk.js?identifier=${encodeURIComponent(id)}`,
  };
  return urls[use] ? {use, id, url: urls[use]} : null;
}

/** SDKs can add their API/DOM after the script load; never keep polling indefinitely. */
async function waitFor<T>(get: () => T | null | undefined, timeout = 8000): Promise<T | null> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = get();
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

export async function initializeChat(config: ChatConfig, win: IntegrationWindow, root: Document, load: ScriptLoader) {
  const plan = chatPlan(config);
  const button = root.getElementById('chat-btn') as HTMLButtonElement | null;
  if (!plan) {button?.remove(); return false;}
  const customButton = enabled(config.rightside_button);
  const scrollVisibility = !customButton && enabled(config.button_hide_show);
  let opened = false;
  const setOpened = (value: boolean) => {opened = value; button?.setAttribute('aria-expanded', String(value));};
  if (plan.use === 'chatra') {
    win.ChatraID = plan.id;
    win.Chatra ??= Object.assign((...args: unknown[]) => win.Chatra!.q!.push(args), {q: [] as unknown[][]});
    if (customButton) win.ChatraSetup = {...win.ChatraSetup, startHidden: true};
  } else if (plan.use === 'crisp') {
    win.CRISP_WEBSITE_ID = plan.id;
    win.$crisp ??= [];
    win.$crisp.push(['safe', true]);
    if (customButton) win.$crisp.push(['do', 'chat:hide']);
  }
  let tidioReady = false;
  const ready = () => {tidioReady = true;};
  if (plan.use === 'tidio') root.addEventListener('tidioChat-ready', ready, {once: true});
  const loaded = await load(plan.url);
  if (!loaded) {root.removeEventListener('tidioChat-ready', ready); button?.remove(); return false;}
  let show: () => void, hide: () => void, open: () => void, close: () => void;
  if (plan.use === 'chatra') {
    show = () => win.Chatra!('show'); hide = () => win.Chatra!('hide');
    open = () => {show(); win.Chatra!('openChat', true);};
    close = () => {win.Chatra!('minimizeWidget'); hide();};
    win.Chatra!('on', 'chatOpen', () => setOpened(true));
    win.Chatra!('on', 'chatClose', () => {setOpened(false); if (customButton) hide();});
  } else if (plan.use === 'crisp') {
    show = () => {win.$crisp!.push(['do', 'chat:show']);}; hide = () => {win.$crisp!.push(['do', 'chat:hide']);};
    open = () => {show(); win.$crisp!.push(['do', 'chat:open']);};
    close = () => {win.$crisp!.push(['do', 'chat:close']); hide();};
    win.$crisp!.push(['on', 'chat:opened', () => setOpened(true)]);
    win.$crisp!.push(['on', 'chat:closed', () => {setOpened(false); if (customButton) hide();}]);
  } else if (plan.use === 'tidio') {
    const api = await waitFor(() => win.tidioChatApi);
    if (api) api.on('ready', ready);
    if (!api || !await waitFor(() => tidioReady || null)) {root.removeEventListener('tidioChat-ready', ready); button?.remove(); return false;}
    root.removeEventListener('tidioChat-ready', ready);
    show = () => api.show(); hide = () => api.hide();
    open = () => {api.show(); api.open();}; close = () => {api.close(); api.hide();};
    api.on('open', () => setOpened(true)); api.on('close', () => {setOpened(false); if (customButton) hide();});
  } else {
    const widget = await waitFor(() => root.getElementById('contact-widget-auto'));
    if (!widget) {button?.remove(); return false;}
    show = () => {widget.style.display = '';}; hide = () => {widget.style.display = 'none';};
    // Knocket 5.7.0 only exposes its floating contact widget, not a chat-open API.
    open = show; close = hide;
  }
  if (customButton) {
    hide();
    root.documentElement.dataset.chatButton = plan.use;
    if (button) {
      button.disabled = false;
      button.addEventListener('click', () => {
        const next = !opened;
        try {if (next) open(); else close(); setOpened(next);} catch {button.remove();}
      });
      button.addEventListener('keydown', event => {
        if (event.key === 'Escape' && opened) {close(); setOpened(false); button.focus();}
      });
    }
  } else if (scrollVisibility) {
    let previous = win.scrollY;
    win.addEventListener('scroll', () => {
      const top = win.scrollY;
      if (!opened && Math.abs(top - previous) > 4) {if (top > previous) hide(); else show();}
      previous = top;
    }, {passive: true});
  }
  return true;
}
