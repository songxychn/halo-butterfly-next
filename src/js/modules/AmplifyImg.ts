/** MIT Viewer.js adapter shared by article, page, photo and moment entries. */
import Viewer from 'viewerjs';
import viewerCss from 'viewerjs/dist/viewer.css?inline';

const KEY = Symbol.for('halo-butterfly-next.lightbox');
declare global { interface Document { [KEY]?: AmplifyImg } }
const SELECTOR = '.main > .content img';
const labels: Record<string, string> = {
  'zoom-in': '放大', 'zoom-out': '缩小', 'one-to-one': '原始尺寸', reset: '重置',
  prev: '上一张', next: '下一张', play: '播放幻灯片', stop: '停止幻灯片',
  'rotate-left': '向左旋转', 'rotate-right': '向右旋转',
  'flip-horizontal': '水平翻转', 'flip-vertical': '垂直翻转', mix: '关闭图片',
};

export function imageSource(image: HTMLImageElement) {
  return image.dataset.lazySrc || image.currentSrc || image.getAttribute('src') || '';
}

function eligible(image: HTMLImageElement) {
  if (image.closest('button, [data-no-lightbox]')) return false;
  const anchor = image.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return true;
  if (anchor.hasAttribute('download')) return false;
  try {
    const href = new URL(anchor.href, document.baseURI);
    return href.href === new URL(imageSource(image), document.baseURI).href ||
      /\.(?:avif|gif|jpe?g|png|svg|webp|bmp)$/i.test(href.pathname);
  } catch { return false; }
}

function group(image: HTMLImageElement) {
  return image.closest('[data-lightbox-group], [data-fancybox]')?.getAttribute('data-lightbox-group') ??
    image.closest('[data-fancybox]')?.getAttribute('data-fancybox') ?? '';
}

export default class AmplifyImg {
  name = 'AmplifyImg';
  declare observer: MutationObserver;
  declare viewer: Viewer | null | undefined;

  constructor() {
    if (document[KEY]) return document[KEY];
    document[KEY] = this;
    const style = document.createElement('style');
    style.dataset.themeLightbox = '';
    style.textContent = viewerCss + `
      .theme-lightbox-trigger{cursor:zoom-in}
      .theme-lightbox-trigger:focus-visible,.theme-lightbox [role=button]:focus-visible{outline:3px solid #49b1f5;outline-offset:3px}
      .theme-lightbox .viewer-container{background:rgba(0,0,0,.92)}
      .theme-lightbox .viewer-toolbar>ul>li{width:44px;height:44px;margin:2px;background:#333}
      .theme-lightbox .viewer-toolbar>ul>li:before{margin:12px}
      .theme-lightbox .viewer-toolbar>ul{max-width:100%;white-space:normal}
      .theme-lightbox .viewer-thumbnails{color:white;font-size:14px;line-height:44px}
      .theme-lightbox .viewer-thumbnails:before{display:none}
      .theme-lightbox .viewer-title{color:white;white-space:normal;opacity:1;background:#222}
      .theme-lightbox .viewer-navbar[hidden]{display:none}
      .theme-lightbox .viewer-list>li:focus-visible{outline:3px solid white;outline-offset:-3px}
    `;
    document.head.append(style);
    this.prepare();
    this.observer = new MutationObserver(() => this.prepare());
    document.querySelectorAll('.main > .content').forEach(content => {
      this.observer.observe(content, {childList: true, subtree: true});
    });
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const trigger = event.target.closest<HTMLElement>('.theme-lightbox-trigger');
      const clickedImage = event.target.closest('img');
      const image = clickedImage && trigger?.contains(clickedImage) ? clickedImage : trigger?.querySelector('img');
      if (!image?.matches(SELECTOR) || !eligible(image)) return;
      event.preventDefault();
      this.open(image, trigger);
    });
    document.addEventListener('keydown', event => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest<HTMLElement>('.theme-lightbox-trigger[role=button]');
      if (trigger && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.open(trigger.querySelector('img'), trigger);
      }
    });
  }

  prepare() {
    document.querySelectorAll<HTMLImageElement>(SELECTOR).forEach(image => {
      if (!eligible(image)) return;
      let trigger = image.closest<HTMLElement>('.theme-lightbox-trigger') || image.closest<HTMLAnchorElement>('a[href]');
      if (!trigger) {
        trigger = document.createElement('span');
        trigger.setAttribute('role', 'button');
        trigger.tabIndex = 0;
        image.before(trigger);
        trigger.append(image);
      }
      trigger.classList.add('theme-lightbox-trigger');
      const count = trigger.querySelectorAll('img').length;
      trigger.setAttribute('aria-label', count > 1 ? `查看图片组（${count} 张）` : `查看图片：${image.alt || '图片'}`);
      trigger.setAttribute('aria-haspopup', 'dialog');
    });
  }

  open(image: HTMLImageElement | null, trigger: HTMLElement | null) {
    if (this.viewer || !image || !trigger || !eligible(image)) return;
    const images = [...document.querySelectorAll<HTMLImageElement>(SELECTOR)].filter(candidate => eligible(candidate) && group(candidate) === group(image));
    const index = images.indexOf(image);
    if (index < 0) return;
    const gallery = document.createElement('div');
    for (const original of images) {
      const clone = document.createElement('img');
      clone.src = original.closest<HTMLAnchorElement>('a[href]')?.href || imageSource(original);
      clone.alt = original.alt;
      for (const name of ['crossorigin', 'referrerpolicy']) {
        if (original.hasAttribute(name)) clone.setAttribute(name, original.getAttribute(name)!);
      }
      gallery.append(clone);
    }
    const host = document.createElement('div');
    host.className = 'theme-lightbox';
    document.body.append(host);
    const background = new Map<HTMLElement, boolean>();
    const restore = () => {
      background.forEach((inert, element) => { element.inert = inert; });
      this.viewer?.destroy();
      this.viewer = null;
      host.remove();
      if (trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[inert]')) trigger.focus({preventScroll: true});
    };
    const describe = () => {
      const dialog = host.querySelector('.viewer-container');
      dialog?.setAttribute('aria-label', '图片查看器');
      host.querySelectorAll<HTMLElement>('[data-viewer-action]').forEach(button => {
        const label = labels[button.dataset.viewerAction || ''];
        if (label) { button.setAttribute('aria-label', label); button.title = label; }
      });
      const toolbar = host.querySelector('.viewer-toolbar > ul');
      toolbar?.setAttribute('role', 'group');
      toolbar?.setAttribute('aria-label', '图片操作');
      host.querySelectorAll('.viewer-list > li').forEach((item, i) => {
        item.setAttribute('aria-label', `查看第 ${i + 1} 张图片：${images[i]?.alt || '图片'}`);
        // Viewer marks button thumbnails aria-selected, which belongs to tabs/options.
        item.removeAttribute('aria-selected');
        item.setAttribute('aria-current', String(item.classList.contains('viewer-active')));
      });
      const toggle = host.querySelector('.viewer-thumbnails');
      if (toggle) { toggle.textContent = '缩略'; toggle.setAttribute('aria-label', '显示或隐藏缩略图'); }
    };
    this.viewer = new Viewer(gallery, {
      container: host, className: 'theme-image-viewer', transition: false,
      initialViewIndex: index, fullscreen: false, keyboard: true, focus: true,
      navbar: true, title: image => image.alt || '图片',
      toolbar: {
        zoomIn: true, zoomOut: true, oneToOne: true, reset: true, prev: true,
        play: true, next: true, rotateLeft: true, rotateRight: true,
        flipHorizontal: true, flipVertical: true,
        thumbnails: {show: true, click() {
          const navbar = host.querySelector<HTMLElement>('.viewer-navbar');
          if (!navbar) return;
          navbar.hidden = !navbar.hidden;
          const button = host.querySelector('.viewer-thumbnails');
          button?.setAttribute('aria-expanded', String(!navbar.hidden));
        }},
      },
      ready: describe,
      shown() {
        for (const sibling of document.body.children) {
          if (!(sibling instanceof HTMLElement)) continue;
          if (sibling === host) continue;
          background.set(sibling, sibling.inert);
          sibling.inert = true;
        }
        describe();
      },
      viewed(event) {
        describe();
        const title = host.querySelector('.viewer-title');
        if (!title) return;
        title.textContent = `${event.detail.index + 1} / ${images.length} — ${images[event.detail.index]?.alt || '图片'}`;
        title.setAttribute('aria-live', 'polite');
      },
      hidden: restore,
    });
    host.addEventListener('keydown', event => {
      if (!(event.target instanceof HTMLElement)) return;
      if ((event.key === ' ' || (event.key === 'Enter' && event.target.matches('.viewer-thumbnails'))) && event.target.matches('[role=button]')) {
        event.preventDefault(); event.stopPropagation(); event.target.click();
      }
      if (event.key !== 'Tab') return;
      const targets = [...host.querySelectorAll<HTMLElement>('[tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[hidden]'));
      if (!targets.length) return;
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && (document.activeElement === first || !targets.some(element => element === document.activeElement))) {
        event.preventDefault(); last!.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    this.viewer.show();
  }
}
