import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.AMBIENT_BASE_URL ?? 'http://127.0.0.1:5173';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // Exercise the no-OffscreenCanvas fallback, not just the worker path.
    delete HTMLCanvasElement.prototype.transferControlToOffscreen;
    window.runningTwinkles = () => document.getAnimations().filter(a =>
      a.effect?.target instanceof Element && a.effect.target.classList.contains('firefly') && a.playState === 'running'
    ).length;
  });
  await page.goto(base);
  await page.waitForFunction(() => window.runningTwinkles() > 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.runningTwinkles() === 0);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.runningTwinkles()), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => window.runningTwinkles() > 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.runningTwinkles() === 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.evaluate(() => window.runningTwinkles()), 0, 'preference changes must not restart background motion');
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.runningTwinkles() > 0);
  await page.evaluate(() => document.body.classList.add('reading-mode'));
  await page.waitForFunction(() => window.runningTwinkles() === 0);
  await page.evaluate(() => document.body.classList.remove('reading-mode'));
  await page.waitForFunction(() => window.runningTwinkles() > 0);
  assert.deepEqual(errors, [], 'no ambient runtime errors');
  console.log('DOM fireflies: live reduced motion, visibility, reading mode, and preference/pause ownership passed');
  await page.close();

  const light = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await light.addInitScript(() => {
    localStorage.setItem('raksara-theme', 'light');
    window.fireflyPalettes = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, transfer) {
        if (message.palette) window.fireflyPalettes.push(message.palette);
        super.postMessage(message, transfer);
      }
    };
  });
  await light.goto(base);
  await light.waitForFunction(() => document.documentElement.dataset.theme === 'light' && window.fireflyPalettes.length > 0);
  const palette = await light.evaluate(() => {
    const worker = window.fireflyPalettes.at(-1);
    const layer = document.querySelector('.fireflies-layer');
    const probe = document.createElement('span');
    probe.style.color = 'var(--ff-core)';
    layer.append(probe);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgb = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const css = rgb(getComputedStyle(probe).color);
    const core = rgb(worker.core);
    probe.remove();
    return { css, core, strength: getComputedStyle(layer).getPropertyValue('--ff-strength').trim(), halo: worker.halo };
  });
  assert(palette.css.every((channel, i) => Math.abs(channel - palette.core[i]) <= 1), `DOM and worker light-mode colours must match: ${JSON.stringify(palette)}`);
  assert.equal(palette.strength, '.72');
  assert.equal(Number(palette.halo.split(',').at(-1).replace(')', '')), .1, 'light halos stay restrained');
  await light.screenshot({ path: '.lavish/fireflies-light.png' });
  await light.close();
  console.log('Light fireflies: warm palette matches DOM/worker handoff, with restrained strength and halos');
} finally { await browser.close(); }
