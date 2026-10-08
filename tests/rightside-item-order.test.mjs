import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { applyRightsideItemOrder, bindRightsideConfig, resolveRightsideItemOrder } from '../src/js/core/rightside.ts';

test('order defaults and blank-group fallback match upstream; whitespace, duplicates and unsupported names are safe', () => {
  const defaults = { hide: ['readmode', 'translate', 'darkmode', 'hideAside'], show: ['toc'] };
  assert.deepEqual(resolveRightsideItemOrder(false, 'toc', 'darkmode'), defaults);
  assert.deepEqual(resolveRightsideItemOrder(true, '', '  '), defaults);
  assert.deepEqual(resolveRightsideItemOrder('true', ' toc, darkmode,toc,constructor,__proto__ ', 'darkmode,translate,chat,comment,<button>'), {
    hide: ['toc', 'darkmode'], show: ['translate'],
  });
  assert.deepEqual(resolveRightsideItemOrder(true, 'unknown', 'unknown'), { hide: [], show: [] });
});

// Tiny DOM fixture models reparenting and interaction, without a browser dependency.
function fixture(items = ['readmode', 'translateLink', 'darkmode', 'hide-aside-btn']) {
  const all = new Map();
  const create = id => {
    const classes = new Set();
    const element = {
      id, children: [], dataset: {}, attributes: {}, handlers: {}, hidden: false, inert: false,
      classList: {
        contains: name => classes.has(name),
        remove: name => classes.delete(name),
        toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); },
      },
      appendChild(child) { return this.insertBefore(child, null); },
      insertBefore(child, before) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        const index = before ? this.children.indexOf(before) : this.children.length;
        assert.ok(index >= 0);
        this.children.splice(index, 0, child);
        child.parent = this;
        return child;
      },
      querySelector(selector) {
        for (const child of this.children) {
          if (`#${child.id}` === selector) return child;
          const found = child.querySelector(selector);
          if (found) return found;
        }
        return null;
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(type, callback) { this.handlers[type] = callback; },
      focus() { this.focused = true; },
    };
    all.set(id, element);
    return element;
  };
  const toolbar = create('rightside');
  const hide = toolbar.appendChild(create('rightside-config-hide'));
  const show = toolbar.appendChild(create('rightside-config-show'));
  const gear = show.appendChild(create('rightside-config'));
  const goUp = show.appendChild(create('go-up'));
  for (const id of items) hide.appendChild(create(id));
  const root = { getElementById: id => all.get(id) ?? null };
  return { root, toolbar, hide, show, gear, goUp, create, all };
}

test('custom groups reorder existing enabled buttons, omit unselected items and keep go-up last', () => {
  const f = fixture(['readmode', 'darkmode']); // translate and aside are disabled by the template.
  const dark = f.all.get('darkmode');
  f.toolbar.dataset = { itemOrderEnable: 'true', itemOrderHide: 'translate', itemOrderShow: 'darkmode' };
  applyRightsideItemOrder(f.root);
  assert.equal(f.show.children[1], dark); // same node, preserving its listeners.
  assert.equal(f.show.children.at(-1), f.goUp);
  assert.equal(f.all.get('readmode').hidden, true);
  assert.equal(f.all.get('readmode').inert, true);
  assert.equal(f.all.has('translateLink'), false); // no disabled feature is created.
  assert.equal(f.gear.hidden, true);
  assert.equal(f.hide.inert, true);
});

test('late-created TOC can move to the hidden group and restore the gear; reapplying is stable', () => {
  const f = fixture([]);
  f.toolbar.dataset = { itemOrderEnable: 'true', itemOrderHide: 'toc', itemOrderShow: 'unknown' };
  applyRightsideItemOrder(f.root);
  assert.equal(f.gear.hidden, true);
  const toc = f.show.insertBefore(f.create('mobile-toc-button'), f.goUp);
  applyRightsideItemOrder(f.root);
  applyRightsideItemOrder(f.root);
  assert.deepEqual(f.hide.children, [toc]);
  assert.equal(f.gear.hidden, false);
  assert.equal(toc.hidden, false);
  assert.equal(f.hide.inert, true);
  assert.deepEqual(f.show.children, [f.gear, f.goUp]);
});

test('native gear click exposes keyboard buttons; Escape collapses and restores focus', () => {
  const f = fixture();
  bindRightsideConfig(f.root);
  assert.equal(f.hide.inert, true);
  assert.equal(f.gear.attributes['aria-expanded'], 'false');
  f.gear.handlers.click();
  assert.equal(f.hide.inert, false);
  assert.equal(f.gear.attributes['aria-expanded'], 'true');
  f.hide.handlers.keydown({ key: 'Escape' });
  assert.equal(f.hide.inert, true);
  assert.equal(f.gear.attributes['aria-expanded'], 'false');
  assert.equal(f.gear.focused, true);
});
