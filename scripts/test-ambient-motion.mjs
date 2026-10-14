import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = stripTypeScriptTypes(readFileSync(new URL('../sveltekit/src/lib/fireflies.worker.ts', import.meta.url), 'utf8'));

function worker() {
  let now = 0;
  let nextId = 0;
  let callbacks = 0;
  let draws = 0;
  const pending = new Map();
  class Canvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      return {
        clearRect() {}, fillRect() {},
        createRadialGradient: () => ({ addColorStop() {} }),
        drawImage: () => { draws++; }
      };
    }
  }
  const self = {};
  runInNewContext(source, {
    self, OffscreenCanvas: Canvas, performance: { now: () => now },
    setTimeout: (fn, delay) => { pending.set(++nextId, { fn, due: now + delay }); return nextId; },
    clearTimeout: (id) => pending.delete(id),
    requestAnimationFrame: () => { throw new Error('Ambient renderer must not wake at display refresh rate'); }
  });
  const send = (data) => self.onmessage({ data });
  const palette = { core: 'white', mid: 'gold', halo: 'gold', glassHalo: 'gold' };
  const flies = Array.from({ length: 16 }, () => ({ x: 10, y: 10, size: 30, dx: 20, dy: 20, periodX: 20, periodY: 20, pulse: 6, phase: 0, peak: .8, glass: false }));
  send({ type: 'init', canvas: new Canvas(1280, 900), width: 1280, height: 900, flies, palette, still: false });
  return {
    send, pending, palette, flies,
    draws: () => draws, callbacks: () => callbacks,
    advance(ms) {
      const end = now + ms;
      while (pending.size) {
        const [id, value] = [...pending].sort((a, b) => a[1].due - b[1].due)[0];
        if (value.due > end) break;
        now = value.due;
        pending.delete(id);
        callbacks++;
        value.fn();
      }
      now = end;
    }
  };
}

test('ambient renderer stays within 15fps with no redundant refresh callbacks', () => {
  const env = worker();
  env.advance(2000);
  assert(env.callbacks() >= 29 && env.callbacks() <= 30);
  assert.equal(env.draws(), env.callbacks() * 16);
  assert.equal(env.pending.size, 1);
  console.log(`Ambient 2-second budget: ${env.callbacks()} callbacks / ${env.draws() / 16} paints (baseline: 120 callbacks / 60 paints)`);
  env.send({ type: 'pause' });
  assert.equal(env.pending.size, 0);
  const draws = env.draws();
  env.advance(2000);
  assert.equal(env.draws(), draws);
});

test('live reduced motion draws one static frame and never overrides hidden/reading pause', () => {
  const env = worker();
  env.advance(100);
  const draws = env.draws();
  env.send({ type: 'motion', still: true });
  assert.equal(env.pending.size, 0);
  assert.equal(env.draws(), draws + 16);
  env.advance(2000);
  assert.equal(env.draws(), draws + 16);
  env.send({ type: 'pause' });
  env.send({ type: 'motion', still: false });
  assert.equal(env.pending.size, 0);
  env.send({ type: 'motion', still: true });
  env.send({ type: 'palette', palette: env.palette });
  env.send({ type: 'resize', width: 900, height: 800, flies: env.flies });
  assert.equal(env.draws(), draws + 16);
  env.send({ type: 'resume' });
  assert.equal(env.draws(), draws + 32);
  assert.equal(env.pending.size, 0);
  env.send({ type: 'motion', still: false });
  assert.equal(env.pending.size, 1);
  env.send({ type: 'resume' });
  assert.equal(env.pending.size, 1, 'resume cannot create a second loop');
});
