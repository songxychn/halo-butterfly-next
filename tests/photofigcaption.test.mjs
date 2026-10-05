import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPhotoFigcaptions, photoCaptionText, resolvePhotoFigcaption } from '../src/js/core/photofigcaption.ts';

// Minimal DOM fixture: assertions concern retained nodes and caption placement,
// not serialized implementation strings. Browser verification covers actual DOM.
class Element {
  constructor(tag, attrs = {}, ...children) {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.children = [];
    this.ownerDocument = { createElement: tag => new Element(tag) };
    this.append(...children);
  }
  get title() { return this.attrs.title || ''; }
  get alt() { return this.attrs.alt || ''; }
  get className() { return this.attrs.class || ''; }
  set className(value) { this.attrs.class = value; }
  hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  matches(selector) { return selector.split(',').some(part => { const s = part.trim(); return s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.tag === s; }); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  contains(child) { return child === this || this.children.some(item => item.contains(child)); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  after(child) { child.parentElement = this.parentElement; this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, child); }
}
const el = (tag, attrs, ...children) => new Element(tag, attrs, ...children);

test('photofigcaption is opt-in and follows pinned upstream title then alt priority', () => {
  for (const value of [false, 'false', undefined, null, '', 1]) assert.equal(resolvePhotoFigcaption(value), false);
  assert.equal(resolvePhotoFigcaption(true), true);
  assert.equal(resolvePhotoFigcaption('true'), true);
  assert.equal(photoCaptionText({ title: 'title', alt: 'alt' }), 'title');
  assert.equal(photoCaptionText({ title: '', alt: 'alt' }), 'alt');
});

test('disabled and empty captions preserve content; text is never parsed as HTML', () => {
  const image = el('img', { title: '<img src=x onerror=alert(1)>', alt: 'accessible alternative' });
  const article = el('article', {}, image, el('img', { alt: '' }), el('img', { title: ' ' }));
  assert.equal(applyPhotoFigcaptions(article, false), 0);
  assert.equal(article.children.length, 3);
  assert.equal(applyPhotoFigcaptions(null, true), 0);
  assert.equal(applyPhotoFigcaptions(article, true), 1);
  const caption = image.nextElementSibling;
  assert.equal(caption.textContent, image.title);
  assert.equal(caption.children.length, 0);
  assert.equal(image.alt, 'accessible alternative');
  assert.equal(applyPhotoFigcaptions(article, true), 0);
});

test('single-image link and picture retain identity with caption outside the link', () => {
  const image = el('img', { alt: 'view' });
  const source = el('source', { srcset: 'wide.webp' });
  const picture = el('picture', {}, source, image);
  const link = el('a', { href: '/original.webp', class: 'theme-lightbox-trigger' }, picture);
  const paragraph = el('p', {}, link);
  const article = el('article', {}, paragraph);
  assert.equal(applyPhotoFigcaptions(article, 'true'), 1);
  assert.equal(paragraph.children[0], link);
  assert.equal(picture.children[1], image);
  assert.equal(picture.children[0], source);
  assert.equal(link.nextElementSibling.tag, 'span');
  assert.equal(link.attrs.href, '/original.webp');
});

test('existing editor and upstream captions are preserved; bare figures gain one figcaption', () => {
  const authored = el('figcaption', {}); authored.textContent = 'editor caption';
  const figure = el('figure', {}, el('img', { title: 'do not duplicate' }), authored);
  const bareFigure = el('figure', {}, el('img', { alt: 'new caption' }));
  const upstream = el('p', {}, el('img', { alt: 'existing' }), el('span', { class: 'img-alt' }));
  const article = el('article', {}, figure, bareFigure, upstream);
  assert.equal(applyPhotoFigcaptions(article, true), 1);
  assert.equal(figure.children.length, 2);
  assert.equal(figure.children[1], authored);
  assert.equal(bareFigure.children[1].tag, 'figcaption');
  assert.equal(bareFigure.children[1].textContent, 'new caption');
  assert.equal(upstream.children.length, 2);
  assert.equal(applyPhotoFigcaptions(article, true), 0);
});

test('shared links preserve images and captions, while code and button images stay untouched', () => {
  const first = el('img', { alt: 'first' }), second = el('img', { alt: 'second' });
  const link = el('a', { href: '/both' }, first, second);
  const article = el('article', {}, link, el('pre', {}, el('img', { alt: 'code' })), el('button', {}, el('img', { alt: 'control' })));
  assert.equal(applyPhotoFigcaptions(article, true), 2);
  assert.deepEqual(link.children.filter(item => item.tag === 'img'), [first, second]);
  assert.equal(first.nextElementSibling.textContent, 'first');
  assert.equal(second.nextElementSibling.textContent, 'second');
});
