/**
 * 对齐 Butterfly 5.7.0 translate（_config.yml / layout/includes/rightside.pug
 * #translateLink / source/js/tw_cn.js / source/js/main.js translateLink，
 * f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * Halo 新组 translate.enable 默认 false；仅显式 true 渲染 #translateLink。
 * translate.default 默认「繁」，作按钮初始文案。defaultEncoding / translateDelay /
 * 两套 msg 本刀不进设置，沿用上游默认 2 / 0 / 繁 / 簡。
 * 点击用 textContent 切按钮文案并转换页面文本，不走 innerHTML。
 * 不复用作者卡片 aside.button。不做 item_order / snackbar / pjax。
 */
import { JTPYStr, FTPYStr } from './translate-maps.ts';

export const TRANSLATE_ENABLE_DEFAULT = false;
export const TRANSLATE_DEFAULT_TEXT = '繁';
export const TRANSLATE_DEFAULT_ENCODING = 2;
export const MSG_TO_TRADITIONAL = '繁';
export const MSG_TO_SIMPLIFIED = '簡';
export const TRANSLATE_STORAGE_KEY = 'translate-chn-cht';
export const TRANSLATE_STORAGE_TTL_DAYS = 2;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 上游默认 false；仅显式 true 开启。 */
export function resolveTranslateEnable(value: unknown) {
  return isExplicitTrue(value);
}

/** 上游 default: 繁；空值回退。 */
export function resolveTranslateDefault(value: unknown) {
  if (value == null || value === '') return TRANSLATE_DEFAULT_TEXT;
  return String(value);
}

let s2tMap: Map<string, string> | null = null;
let t2sMap: Map<string, string> | null = null;

function getMaps() {
  if (!s2tMap) {
    const ss = JTPYStr;
    const tt = FTPYStr;
    s2tMap = new Map();
    t2sMap = new Map();
    for (let i = 0; i < ss.length; i++) {
      s2tMap.set(ss[i], tt[i]);
      t2sMap.set(tt[i], ss[i]);
    }
  }
  return { s2tMap, t2sMap: t2sMap! };
}

export function traditionalized(cc: string) {
  const { s2tMap: map } = getMaps();
  let str = '';
  for (let i = 0; i < cc.length; i++) {
    const ch = cc.charAt(i);
    str += cc.charCodeAt(i) > 10000 && map.has(ch) ? map.get(ch) : ch;
  }
  return str;
}

export function simplified(cc: string) {
  const { t2sMap: map } = getMaps();
  let str = '';
  for (let i = 0; i < cc.length; i++) {
    const ch = cc.charAt(i);
    str += cc.charCodeAt(i) > 10000 && map.has(ch) ? map.get(ch) : ch;
  }
  return str;
}

export function translateText(txt: string, currentEncoding: number, targetEncoding: number) {
  if (!txt) return '';
  if (currentEncoding === 1 && targetEncoding === 2) return simplified(txt);
  if (currentEncoding === 2 && targetEncoding === 1) return traditionalized(txt);
  return txt;
}

export function setDocumentLang(html: HTMLElement | null | undefined, targetEncoding: number) {
  if (!html) return;
  html.lang = targetEncoding === 1 ? 'zh-TW' : 'zh-CN';
}

function skipNode(node: Node, button: HTMLElement | null | undefined) {
  return ['BR', 'HR'].includes((node as Element).tagName) || node === button;
}

export function translateBody(fobj: Node | null | undefined, button: HTMLElement | null | undefined, currentEncoding: number, targetEncoding: number) {
  const nodes = fobj && typeof fobj === 'object' ? fobj.childNodes : null;
  if (!nodes) return;
  const list = typeof nodes.length === 'number' ? Array.from(nodes) : nodes;
  for (const node of list) {
    if (!node || skipNode(node, button)) continue;
    if (node.nodeType === ELEMENT_NODE) {
      const element = node as HTMLElement & {alt?: string; placeholder?: string; value?: string; type?: string};
      const { tagName, title, alt, placeholder, value, type } = element;
      if (title) element.title = translateText(title, currentEncoding, targetEncoding);
      if (alt) element.alt = translateText(alt, currentEncoding, targetEncoding);
      if (placeholder) element.placeholder = translateText(placeholder, currentEncoding, targetEncoding);
      if (tagName === 'INPUT' && value && type !== 'text' && type !== 'hidden') {
        element.value = translateText(value, currentEncoding, targetEncoding);
      }
      translateBody(node, button, currentEncoding, targetEncoding);
    } else if (node.nodeType === TEXT_NODE) {
      (node as Text).data = translateText((node as Text).data, currentEncoding, targetEncoding);
    }
  }
}

export function readSavedEncoding(storage: Storage | null | undefined) {
  if (!storage || typeof storage.getItem !== 'function') return undefined;
  const itemStr = storage.getItem(TRANSLATE_STORAGE_KEY);
  if (!itemStr) return undefined;
  try {
    const data = JSON.parse(itemStr);
    if (data.expiry && Date.now() > data.expiry) {
      storage.removeItem(TRANSLATE_STORAGE_KEY);
      return undefined;
    }
    const n = Number(data.value);
    return n === 1 || n === 2 ? n : undefined;
  } catch {
    storage.removeItem(TRANSLATE_STORAGE_KEY);
    return undefined;
  }
}

export function writeSavedEncoding(value: unknown, storage: Storage | null | undefined, ttlDays = TRANSLATE_STORAGE_TTL_DAYS, now = Date.now()) {
  if (!storage || typeof storage.setItem !== 'function') return;
  const data: {value: unknown; expiry?: number} = { value };
  if (ttlDays != null) data.expiry = now + ttlDays * 86400000;
  storage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify(data));
}

interface TranslateOptions {
  button?: HTMLElement | null; body?: HTMLElement | null; html?: HTMLElement | null; storage?: Storage | null;
  defaultEncoding?: number; msgToTraditionalChinese?: string; msgToSimplifiedChinese?: string;
}
type TranslateState = ReturnType<typeof createTranslateState>;

export function createTranslateState({
  button,
  body,
  html,
  storage,
  defaultEncoding = TRANSLATE_DEFAULT_ENCODING,
  msgToTraditionalChinese = MSG_TO_TRADITIONAL,
  msgToSimplifiedChinese = MSG_TO_SIMPLIFIED,
}: TranslateOptions = {}) {
  const currentEncoding = defaultEncoding;
  const saved = readSavedEncoding(storage);
  const targetEncoding = saved || defaultEncoding;
  return {
    button,
    body,
    html,
    storage,
    currentEncoding,
    targetEncoding,
    msgToTraditionalChinese,
    msgToSimplifiedChinese,
  };
}

function applyButtonLabel(state: TranslateState) {
  if (!state.button) return;
  state.button.textContent =
    state.targetEncoding === 1 ? state.msgToSimplifiedChinese : state.msgToTraditionalChinese;
}

export function initializeTranslate(state: TranslateState) {
  if (!state?.button) return state;
  if (state.currentEncoding !== state.targetEncoding) {
    applyButtonLabel(state);
    setDocumentLang(state.html, state.targetEncoding);
    translateBody(state.body, state.button, state.currentEncoding, state.targetEncoding);
    state.currentEncoding = state.targetEncoding;
  }
  return state;
}

export function translatePage(state: TranslateState) {
  if (!state?.button) return state;
  if (state.targetEncoding === 1) {
    state.currentEncoding = 1;
    state.targetEncoding = 2;
    state.button.textContent = state.msgToTraditionalChinese;
  } else if (state.targetEncoding === 2) {
    state.currentEncoding = 2;
    state.targetEncoding = 1;
    state.button.textContent = state.msgToSimplifiedChinese;
  }
  writeSavedEncoding(state.targetEncoding, state.storage);
  setDocumentLang(state.html, state.targetEncoding);
  translateBody(state.body, state.button, state.currentEncoding, state.targetEncoding);
  return state;
}

export function bindTranslate(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  const button = root.getElementById('translateLink');
  if (!button) return;
  const body = root.body || (typeof document !== 'undefined' ? document.body : null);
  const html = root.documentElement || (typeof document !== 'undefined' ? document.documentElement : null);
  let storage = null;
  try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
  const state = createTranslateState({ button, body, html, storage });
  initializeTranslate(state);
  button.addEventListener('click', () => {
    translatePage(state);
  });
}
