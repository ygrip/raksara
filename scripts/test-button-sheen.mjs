// Run against dev/preview: BUTTON_SHEEN_BASE_URL=http://localhost:5173 npm run test:button-sheen
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BUTTON_SHEEN_BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const errors = [];
const animationState = (el) => {
  const style = getComputedStyle(el, '::before');
  const animations = el.getAnimations({ subtree: true }).filter((a) => a.animationName === 'hg-button-sheen');
  return { display: style.display, opacity: style.opacity, count: animations.length };
};

async function idle(page, button) {
  await page.mouse.move(0, 0);
  await button.evaluate((el) => el.blur());
}

async function hover(button) {
  await button.scrollIntoViewIfNeeded();
  await button.page().evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await button.hover();
}

async function sweep(button) {
  const snapshot = await button.evaluate((el) => {
    const animation = el.getAnimations({ subtree: true }).find((a) => a.animationName === 'hg-button-sheen');
    if (!animation) return null;
    const timing = animation.effect.getTiming();
    const playState = animation.playState;
    animation.pause();
    animation.currentTime = 250;
    const middle = getComputedStyle(el, '::before');
    const state = { duration: timing.duration, iterations: timing.iterations, playState,
      display: middle.display, opacity: Number(middle.opacity), zIndex: middle.zIndex, pointerEvents: middle.pointerEvents };
    animation.play();
    return state;
  });
  assert.ok(snapshot, 'interaction starts the sheen');
  assert.equal(snapshot.duration, 500);
  assert.equal(snapshot.iterations, 1);
  assert.ok(['running', 'finished'].includes(snapshot.playState), 'CSS starts motion without JS');
  assert.notEqual(snapshot.display, 'none', 'sheen is painted');
  assert.ok(snapshot.opacity > 0.9, 'sheen is visible at the midpoint');
  assert.equal(snapshot.zIndex, '-1', 'sheen stays behind the label');
  assert.equal(snapshot.pointerEvents, 'none');
  await button.page().waitForTimeout(650);
  const final = await button.evaluate((el) => ({
    opacity: getComputedStyle(el, '::before').opacity,
    states: el.getAnimations({ subtree: true }).filter((a) => a.animationName === 'hg-button-sheen').map((a) => a.playState),
  }));
  assert.equal(final.opacity, '0');
  assert.deepEqual(final.states, ['finished'], 'held interaction never loops');
}

async function keyboardFocus(page, button) {
  await button.evaluate((el) => {
    const sentinel = document.createElement('button');
    sentinel.id = 'sheen-focus-start';
    el.before(sentinel);
    sentinel.focus();
  });
  await page.keyboard.press('Tab');
  assert.ok(await button.evaluate((el) => el === document.activeElement && el.matches(':focus-visible')));
  await page.locator('#sheen-focus-start').evaluate((el) => el.remove());
}

try {
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem('raksara-theme', value), theme);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    const button = page.locator('.home-btn-primary').first();
    await button.waitFor();
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
    const baseline = await button.evaluate((el) => ({
      label: el.textContent.trim(), href: el.getAttribute('href'), width: el.getBoundingClientRect().width,
      mask: getComputedStyle(el, '::after').maskImage,
    }));
    assert.notEqual(baseline.mask, 'none', 'existing carved lotus is present');
    await idle(page, button);
    assert.equal((await button.evaluate(animationState)).count, 0, 'no idle animation');
    await hover(button);
    await sweep(button);
    assert.equal(await button.evaluate((el) => getComputedStyle(el).overflowX), 'hidden', 'sheen is clipped to the pill');
    assert.equal(await button.evaluate((el) => getComputedStyle(el, '::after').maskImage), baseline.mask);
    assert.equal(await button.textContent().then((text) => text.trim()), baseline.label);
    assert.equal(await button.evaluate((el) => el.getBoundingClientRect().width), baseline.width);
    await idle(page, button);
    await keyboardFocus(page, button);
    await sweep(button);
    assert.notEqual(await button.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal((await button.evaluate(animationState)).display, 'none');
    assert.equal((await button.evaluate(animationState)).count, 0);
    assert.notEqual(await button.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    assert.equal((await button.evaluate(animationState)).display, 'none');
    assert.notEqual(await button.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    await page.emulateMedia({ forcedColors: 'none' });
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-transparency', value: 'reduce' },
    ] });
    assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches));
    assert.equal((await button.evaluate(animationState)).display, 'none');
    await session.send('Emulation.setEmulatedMedia', { features: [] });
    await session.detach();
    await page.emulateMedia({ media: 'print' });
    assert.equal((await button.evaluate(animationState)).display, 'none');
    await page.emulateMedia({ media: 'screen' });
    await idle(page, button);

    const secondary = page.locator('.home-btn-secondary').first();
    await secondary.hover();
    assert.equal((await secondary.evaluate(animationState)).count, 0, 'secondary buttons remain quiet');
    assert.equal(await secondary.evaluate((el) => getComputedStyle(el, '::before').display), 'none');
    await button.evaluate((el) => el.addEventListener('click', (event) => {
      event.preventDefault(); el.dataset.sheenClicked = 'true';
    }, { once: true }));
    await button.click();
    assert.equal(await button.getAttribute('data-sheen-clicked'), 'true', 'link is still clickable');
    assert.equal(await button.getAttribute('href'), baseline.href);
    await context.close();
  }

  const mobile = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await mobile.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  const button = page.locator('.home-btn-primary').first();
  await button.hover();
  assert.equal((await button.evaluate(animationState)).count, 0, 'coarse pointer never enables hover sheen');
  await idle(page, button);
  await keyboardFocus(page, button);
  await sweep(button);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no narrow-screen overflow');
  await mobile.close();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Button sheen browser checks passed.');
} finally {
  await browser.close();
}
