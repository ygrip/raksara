import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const source = readFileSync(new URL('../sveltekit/src/lib/actions/scroll-motion.ts', import.meta.url), 'utf8');
const motion = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
  count(type) { return this.listeners.get(type)?.size ?? 0; }
}

function setup({ reduced = false, mobile = true, fine = true, timelines = true } = {}) {
  const media = new Map();
  for (const [query, matches] of [
    ['(prefers-reduced-motion: reduce)', reduced],
    ['(max-width: 768px)', mobile],
    ['(hover: hover) and (pointer: fine)', fine]
  ]) {
    const value = new Events();
    value.matches = matches;
    value.change = (next) => { value.matches = next; value.emit('change'); };
    media.set(query, value);
  }
  const frames = new Map();
  let nextFrame = 0;
  const win = new Events();
  Object.assign(win, {
    scrollY: 0,
    matchMedia: (query) => media.get(query),
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id)
  });
  globalThis.window = win;
  const doc = new Events();
  doc.visibilityState = 'visible';
  globalThis.document = doc;
  globalThis.CSS = { supports: () => timelines };
  let disconnected = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() { disconnected++; }
  };
  const hero = new Events();
  const values = new Map();
  const classes = new Set();
  hero.style = {
    setProperty: (key, value) => values.set(key, value),
    removeProperty: (key) => values.delete(key)
  };
  hero.classList = {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
  };
  hero.getBoundingClientRect = () => ({ left: 0, top: -win.scrollY, width: 1000, height: 500 });
  return {
    hero, win, doc, values, classes, frames, media,
    disconnected: () => disconnected,
    flush: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }
  };
}

function pointer(hero, x, y, pointerType = 'mouse') {
  hero.emit('pointermove', { clientX: x, clientY: y, pointerType });
}

test('hero tilt coalesces frames, clamps to nine degrees and restores resting state', () => {
  const env = setup();
  const detach = motion.attachHeroTilt(env.hero);
  assert(env.classes.has('rk-pointer-depth'));
  pointer(env.hero, 100, 200);
  pointer(env.hero, 2000, -100);
  assert.equal(env.frames.size, 1);
  env.flush();
  assert.equal(env.values.get('--rk-tilt-x'), '9deg');
  assert.equal(env.values.get('--rk-tilt-y'), '9deg');
  assert.equal(env.values.size, 2, 'only compositor transform inputs are written');
  assert(env.classes.has('rk-pointer-active'));
  env.hero.emit('pointerleave');
  assert.equal(env.values.size, 0);
  assert(!env.classes.has('rk-pointer-active'));
  pointer(env.hero, 100, 200);
  detach();
  assert.equal(env.frames.size, 0);
  assert.equal(env.hero.count('pointermove'), 0);
  assert.equal(env.win.count('blur'), 0);
  assert.equal(env.doc.count('visibilitychange'), 0);
  assert.equal(env.classes.size, 0);
});

test('touch never tilts and live reduced motion cancels pending work', () => {
  const env = setup();
  const detach = motion.attachHeroTilt(env.hero);
  pointer(env.hero, 100, 200, 'touch');
  assert.equal(env.frames.size, 0);
  pointer(env.hero, 100, 200);
  env.media.get('(prefers-reduced-motion: reduce)').change(true);
  assert.equal(env.frames.size, 0);
  assert.equal(env.classes.size, 0);
  pointer(env.hero, 100, 200);
  assert.equal(env.frames.size, 0);
  env.media.get('(prefers-reduced-motion: reduce)').change(false);
  assert(env.classes.has('rk-pointer-depth'));
  env.media.get('(hover: hover) and (pointer: fine)').change(false);
  pointer(env.hero, 100, 200);
  assert.equal(env.frames.size, 0);
  detach();
});

test('scroll depth clamps travel and removes listeners/styles on preference change', () => {
  const env = setup();
  const detach = motion.attachScrollDepth(env.hero, 360);
  env.win.scrollY = 900;
  env.win.emit('scroll');
  env.flush();
  assert.equal(env.values.get('--rk-profile-cover-y'), '120px');
  assert.equal(env.values.get('--rk-profile-card-y'), '-64px');
  assert.equal(env.values.get('--rk-mobile-profile-card-y'), '-34px');
  env.media.get('(prefers-reduced-motion: reduce)').change(true);
  assert.equal(env.values.size, 0);
  assert.equal(env.win.count('scroll'), 0);
  assert.equal(env.frames.size, 0);
  assert.equal(env.disconnected(), 1);
  env.media.get('(prefers-reduced-motion: reduce)').change(false);
  assert.equal(env.win.count('scroll'), 1);
  detach();
  assert.equal(env.win.count('scroll'), 0);
  assert.equal(env.win.count('resize'), 0);
  assert.equal(env.frames.size, 0);
  assert.equal(env.media.get('(prefers-reduced-motion: reduce)').count('change'), 0);
});

test('desktop timelines need no scroll listener; crossing mobile breakpoint switches ownership', () => {
  const env = setup({ mobile: false });
  const detach = motion.attachScrollDepth(env.hero, 420);
  assert.equal(env.win.count('scroll'), 0);
  env.media.get('(max-width: 768px)').change(true);
  assert.equal(env.win.count('scroll'), 1);
  env.media.get('(max-width: 768px)').change(false);
  assert.equal(env.win.count('scroll'), 0);
  assert.equal(env.values.size, 0);
  assert(!env.classes.has('rk-js-depth'));
  detach();
});

test('backgrounding the page cancels pending pointer work', () => {
  const env = setup();
  const detach = motion.attachHeroTilt(env.hero);
  pointer(env.hero, 100, 200);
  env.doc.visibilityState = 'hidden';
  env.doc.emit('visibilitychange');
  assert.equal(env.frames.size, 0);
  pointer(env.hero, 100, 200);
  assert.equal(env.frames.size, 0);
  detach();
});

test('unsupported desktop uses fallback; initial reduced motion remains static', () => {
  let env = setup({ mobile: false, timelines: false });
  let detach = motion.attachScrollDepth(env.hero, 420);
  assert.equal(env.win.count('scroll'), 1);
  detach();
  env = setup({ reduced: true });
  detach = motion.attachScrollDepth(env.hero, 420);
  const detachTilt = motion.attachHeroTilt(env.hero);
  assert.equal(env.win.count('scroll'), 0);
  assert.equal(env.frames.size, 0);
  assert.equal(env.classes.size, 0);
  detach();
  detachTilt();
});
