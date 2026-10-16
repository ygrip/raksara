// Run against dev/preview: BORDER_BEAM_BASE_URL=http://localhost:5173 npm run test:border-beam
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.env.BORDER_BEAM_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
const items = [true, false].map((featured) => ({
  title: `Beam ${featured ? 'featured' : 'ordinary'} fixture`,
  slug: `beam-${featured ? 'featured' : 'ordinary'}`,
  path: `content/portfolio/beam-${featured ? 'featured' : 'ordinary'}.md`,
  section: 'portfolio', date: '2026-01-01', featured,
  summary: 'A bounded browser-test fixture.',
  github: 'https://github.com/example/beam', demo: 'https://example.com/beam',
}));
const cardOf = (page) => page.locator('.portfolio-card').filter({ hasText: items[0].title });

async function navigate(page, path) {
  // Initial SSR fetches bypass browser interception; exercise client navigation instead.
  await page.evaluate((href) => {
    const link = document.createElement('a');
    link.href = href;
    document.body.append(link);
    link.click();
    link.remove();
  }, path);
  await page.waitForURL(`${base}${path}`);
  await page.locator(path === '/' ? '.portfolio-grid[data-tilt]' : '.timeline[data-tilt]').waitFor();
  await cardOf(page).waitFor();
}

async function setup(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await context.request.get(`${base}/metadata/config.json`);
  assert.ok(response.ok(), 'generated config is available');
  const config = await response.json();
  let yaml = true;
  await page.route('**/metadata/**', async (route) => {
    const name = new URL(route.request().url()).pathname.slice('/metadata/'.length);
    const fixtures = {
      'portfolio.json': items,
      'home-bundle.json': { config, posts: [], portfolio: items, thoughts: [], gallery: [] },
      'homepage.json': yaml ? {
        hero: { title: 'Beam fixtures' },
        sections: [{ type: 'projects', title: 'Fixture projects' }],
      } : null,
      'gallery.json': [], 'thoughts.json': [], 'image-manifest.json': {},
    };
    if (Object.hasOwn(fixtures, name)) await route.fulfill({ json: fixtures[name] });
    else await route.continue();
  });
  await page.goto(`${base}/portfolio/`);
  await page.locator('.timeline[data-tilt]').waitFor();
  await navigate(page, '/');
  return { context, page, legacy: () => { yaml = false; } };
}

async function idle(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
}

async function hoverFineCard(card) {
  // Auto-scroll can cancel tilt's queued pointer frame. Settle layout before moving again.
  await card.scrollIntoViewIfNeeded();
  await card.page().evaluate(() => new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done))));
  await card.hover();
  const box = await card.boundingBox();
  await card.page().mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await card.locator('.t-tilt-glare').waitFor({ state: 'attached' });
}

async function checkGating(page) {
  assert.equal(await page.locator('.portfolio-card').count(), 2);
  const beam = cardOf(page).locator('svg.portfolio-border-beam');
  assert.equal(await beam.count(), 1);
  assert.equal(await page.locator('.portfolio-card')
    .filter({ hasText: items[1].title }).locator('.portfolio-border-beam').count(), 0);
  assert.equal(await beam.getAttribute('aria-hidden'), 'true');
  assert.equal(await beam.getAttribute('focusable'), 'false');
  assert.equal(await beam.locator('rect').getAttribute('pathLength'), '100');
  assert.equal(await beam.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
  await idle(page);
  assert.equal(await beam.locator('rect').evaluate((el) => el.getAnimations().length), 0);
  assert.equal(await beam.locator('rect').evaluate((el) => getComputedStyle(el).opacity), '0');
}

async function checkOneShot(rect) {
  const snapshot = await rect.evaluate((el) => {
    const animation = el.getAnimations()[0];
    if (!animation) return null;
    const { duration, iterations } = animation.effect.getTiming();
    const playState = animation.playState;
    animation.pause();
    animation.currentTime = 250;
    const middleOpacity = Number(getComputedStyle(el).opacity);
    animation.play(); // Resume from the midpoint and verify natural completion below.
    return { duration, iterations, middleOpacity, playState };
  });
  assert.ok(snapshot, 'interaction starts a beam animation');
  assert.equal(snapshot.duration, 500);
  assert.equal(snapshot.iterations, 1);
  assert.ok(['running', 'finished'].includes(snapshot.playState), 'CSS does not pause the trace');
  assert.ok(snapshot.middleOpacity > 0.9, 'trace is visible mid-cycle');
  await rect.page().waitForTimeout(600);
  assert.equal(await rect.evaluate((el) => getComputedStyle(el).opacity), '0');
  assert.ok(await rect.evaluate((el) =>
    el.getAnimations().every((animation) => animation.playState === 'finished')),
  'held interaction does not restart motion');
}

async function focusByKeyboard(card) {
  const link = card.locator('a').first();
  await card.evaluate((el) => {
    const sentinel = document.createElement('button');
    sentinel.id = 'beam-focus-start';
    el.before(sentinel);
    sentinel.focus();
  });
  await card.page().keyboard.press('Tab');
  assert.ok(await link.evaluate((el) => el === document.activeElement));
  await card.page().locator('#beam-focus-start').evaluate((el) => el.remove());
  return link;
}

try {
  const desktop = await setup({ viewport: { width: 1280, height: 900 } });
  const { page } = desktop;
  for (const path of ['/', '/portfolio/']) {
    if (path !== '/') await navigate(page, path);
    await checkGating(page);
    const card = cardOf(page);
    const rect = card.locator('.portfolio-border-beam rect');
    await hoverFineCard(card);
    await checkOneShot(rect);
    assert.ok(await card.evaluate((el) => getComputedStyle(el, '::after').content !== 'none'),
      'carved ornament remains');
    assert.equal(await card.locator('.t-tilt-glare').count(), 1, 'existing tilt still attaches one glare');
    await idle(page);
    const link = await focusByKeyboard(card);
    await checkOneShot(rect);
    assert.notEqual(await link.evaluate((el) => getComputedStyle(el).outlineStyle), 'none',
      'focus outline remains after trace finishes');

    await idle(page);
    await hoverFineCard(card);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await card.locator('.portfolio-border-beam')
      .evaluate((el) => getComputedStyle(el).display), 'none');
    assert.equal(await rect.evaluate((el) => el.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    assert.equal(await card.locator('.portfolio-border-beam')
      .evaluate((el) => getComputedStyle(el).display), 'none');
    await page.emulateMedia({ forcedColors: 'none' });
    await idle(page);
  }

  const surface = cardOf(page).locator('.portfolio-card-surface');
  await surface.evaluate((el) => el.addEventListener('click', (event) => {
    event.preventDefault();
    el.dataset.beamClicked = 'true';
  }, { once: true }));
  await surface.click({ position: { x: 8, y: 8 } });
  assert.equal(await surface.getAttribute('data-beam-clicked'), 'true');
  assert.equal(await cardOf(page).locator('.btn-github').getAttribute('href'), items[0].github);

  desktop.legacy();
  await navigate(page, '/');
  await checkGating(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await hoverFineCard(cardOf(page));
  await checkOneShot(cardOf(page).locator('.portfolio-border-beam rect'));
  await navigate(page, '/portfolio/');
  await navigate(page, '/');
  await checkGating(page);
  await desktop.context.close();

  const mobile = await setup({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
  });
  await navigate(mobile.page, '/portfolio/');
  await checkGating(mobile.page);
  const card = cardOf(mobile.page);
  await card.hover();
  assert.equal(await card.locator('.portfolio-border-beam rect').evaluate((el) => el.getAnimations().length), 0,
    'coarse pointer has no sticky hover beam');
  await idle(mobile.page);
  await focusByKeyboard(card);
  await checkOneShot(card.locator('.portfolio-border-beam rect'));
  assert.ok(await mobile.page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  'narrow viewport has no horizontal overflow');
  await mobile.context.close();

  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Border beam browser checks passed.');
} finally {
  await browser.close();
}
