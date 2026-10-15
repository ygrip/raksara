import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.CARD_BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(theme => localStorage.setItem('raksara-theme', theme), theme);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    const grid = page.locator('.portfolio-grid').first();
    await grid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const layout = await grid.evaluate(el => ({
      width: el.getBoundingClientRect().width,
      gap: parseFloat(getComputedStyle(el).columnGap),
      cards: [...el.children].map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height }))
    }));
    assert(layout.cards.length >= 2, 'featured project fixtures exist');
    assert(layout.cards.every(card => card.width > layout.width * .3 && card.height < 650), 'cards cannot collapse into a single 12-column track');
    assert(Math.abs(layout.cards[0].width + layout.cards[1].width + layout.gap - layout.width) < 1, 'first row fills the bento grid');
    assert(layout.cards[0].width > layout.cards[1].width, 'featured project retains its 7/5-column layout');
    await grid.screenshot({ path: `.lavish/featured-projects-${theme}.png` });
    for (const selector of ['.portfolio-grid', '.home-info-cards']) {
      const group = page.locator(selector).first();
      await group.scrollIntoViewIfNeeded();
      const wrappers = group.locator(':scope > .home-card-depth');
      const first = wrappers.first();
      await first.locator('a').first().focus();
      await page.waitForTimeout(350);
      const focusedCard = await first.locator(':scope > div').boundingBox();
      const focusedWrapper = await first.boundingBox();
      assert(Math.abs(focusedCard.width - focusedWrapper.width) < 1, 'focused card remains stationary');
      if (await wrappers.count() > 1) {
        const sibling = wrappers.nth(1);
        const siblingCard = await sibling.locator(':scope > div').boundingBox();
        const siblingWrapper = await sibling.boundingBox();
        assert(Math.abs(siblingCard.width - siblingWrapper.width) < 1, 'sibling card does not shrink on focus');
      }
      await page.evaluate(() => document.activeElement.blur());
    }
    const featuredCard = grid.locator('.portfolio-card').first();
    await featuredCard.hover();
    await page.waitForFunction(() => {
      const card = document.querySelector('.portfolio-grid .portfolio-card.is-tilt-active');
      const glare = card?.querySelector(':scope > .t-tilt-glare');
      return glare && Number(getComputedStyle(glare).opacity) > 0.05;
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await grid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    assert.equal(await grid.evaluate(el => [...el.children].every(card => Math.abs(card.getBoundingClientRect().width - el.getBoundingClientRect().width) < 1)), true, 'mobile cards fill the row');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile does not overflow');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(new URL('/profile/', base).href);
    await page.mouse.move(0, 0);
    const card = page.locator('.profile-card');
    await card.waitFor();
    await page.waitForFunction(() => document.querySelector('.profile-avatar-wrap.loaded'));
    assert.equal(await page.locator('.profile-avatar').evaluate(el => getComputedStyle(el).animationName), 'profileAvatarBreath', 'medallion breath is preserved');
    const lights = page.locator('.profile-hero > .fireflies-layer');
    await lights.waitFor();
    assert.equal(await lights.count(), 1, 'profile reuses one Fireflies component');
    assert.equal(await page.locator('.bg-gradient .fireflies-layer').count(), 0, 'no duplicate ambient fireflies behind the cover');
    assert.equal(await page.locator('.profile-cover-particles, .profile-cover-star, .profile-cover-firefly').count(), 0, 'duplicate cover effects were removed');
    assert.equal(await lights.locator('.fireflies-canvas').count(), 1, 'profile uses the existing worker-compatible firefly renderer');
    const stacking = await page.locator('.profile-hero').evaluate(hero => ({
      image: Number(getComputedStyle(hero.querySelector('.profile-hero-bg')).zIndex),
      overlay: Number(getComputedStyle(hero.querySelector('.profile-hero-overlay')).zIndex),
      fireflies: Number(getComputedStyle(hero.querySelector(':scope > .fireflies-layer')).zIndex),
      card: Number(getComputedStyle(hero.querySelector('.profile-hero-content')).zIndex),
      pointerEvents: getComputedStyle(hero.querySelector(':scope > .fireflies-layer')).pointerEvents
    }));
    assert(stacking.image < stacking.overlay && stacking.overlay < stacking.fireflies && stacking.fireflies < stacking.card,
      'the existing fireflies render above the cover image and below the identity card');
    assert.equal(stacking.pointerEvents, 'none', 'fireflies never intercept profile interactions');
    const background = await card.evaluate(el => getComputedStyle(el).backgroundColor);
    await card.hover();
    await page.waitForTimeout(150);
    assert.equal(await card.evaluate(el => getComputedStyle(el).backgroundColor), background, 'profile hover does not recolour the card');
    assert.equal(await card.evaluate(el => getComputedStyle(el, '::after').animationName), 'rk-profile-shimmer');
    assert.equal(await card.evaluate(el => getComputedStyle(el, '::after').animationIterationCount), '1');
    await page.waitForTimeout(1100);
    assert.equal(await card.evaluate(el => Number(getComputedStyle(el, '::after').opacity)), 0, 'shimmer ends without leaving a colour wash');
    await card.screenshot({ path: `.lavish/profile-card-${theme}.png` });
    for (const link of await page.locator('.profile-links a').all()) {
      const resting = await link.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
      await link.hover();
      await page.waitForTimeout(300);
      const hover = await link.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform, backdrop: getComputedStyle(el).backdropFilter, animation: getComputedStyle(el).animationName, opacity: getComputedStyle(el).opacity }));
      assert.equal(hover.color, resting.color);
      assert.equal(hover.background, resting.background, 'chip backgrounds remain steady');
      assert.equal(hover.transform, 'none');
      assert.equal(hover.backdrop, 'none');
      assert.equal(hover.animation, 'none');
      assert.equal(hover.opacity, '1');
    }
    const chip = page.locator('.profile-meta-chip').first();
    await chip.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(450);
    const before = await chip.boundingBox();
    await chip.hover();
    assert.equal(await chip.locator('.meta-value').evaluate(el => getComputedStyle(el).animationName), 'rk-meta-text-in', 'metadata text uses an appearing animation');
    await page.waitForTimeout(500);
    assert.equal(await chip.locator('.meta-value').evaluate(el => Number(getComputedStyle(el).opacity)), 1, 'revealed text stays readable');
    const after = await chip.boundingBox();
    assert(Math.abs(before.x - after.x) < .1 && Math.abs(before.y - after.y) < .1, 'metadata tile stays stationary');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    assert.equal(await lights.evaluate(el => getComputedStyle(el).display), 'block', 'reduced motion keeps the original static firefly presentation');
    assert.equal(await lights.locator('.firefly').evaluateAll(nodes => nodes.every(el => el.getAnimations().every(a => a.playState !== 'running'))), true,
      'reduced motion stops active DOM firefly twinkles');
    assert.equal(await page.locator('.profile-avatar').evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced motion stops avatar pulse');
    assert.equal(await chip.locator('.meta-value').evaluate(el => getComputedStyle(el).transform), 'none', 'live reduced motion disables text movement');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${theme}: bento grid, stationary focus, portfolio tilt and shimmer, avatar breath, original above-cover fireflies, 3D/shimmer, stable chips, appearing metadata text and reduced motion passed at ${base}`);
  }
} finally { await browser.close(); }
