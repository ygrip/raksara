// HERO_BASE_URL=http://127.0.0.1:5173 node scripts/test-hero-motion-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.HERO_BASE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  for (const route of ['/', '/profile/']) {
    const home = route === '/';
    const name = home ? 'home' : 'profile';
    for (const theme of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((value) => localStorage.setItem('raksara-theme', value), theme);
      await page.goto(new URL(route, base).href);
      const hero = page.locator(home ? '.home-hero.dot-hero' : '.profile-hero');
      await page.waitForFunction((isHome) => document.querySelector(isHome ? '.home-card-depth.rk-pointer-depth' : '.profile-hero.rk-pointer-depth'), home);
      // The existing profile entrance lasts 760ms; inspect its settled layout.
      await page.waitForTimeout(900);
      const box = await hero.boundingBox();
      assert(box);
      const anchor = home ? await page.locator('.home-hero-visual').boundingBox() : null;
      await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.28);
      await page.waitForTimeout(200);
      const surface = page.locator(home ? '.home-hero-copy' : '.profile-card');
      const tilt = await surface.evaluate((el) => getComputedStyle(el).transform);
      if (home) {
        assert.equal(tilt, 'none', 'hero copy stays stationary');
        assert.equal(await hero.evaluate((el) => el.classList.contains('rk-pointer-depth')), false);
        assert.equal(await page.locator('.home-hero-visual').evaluate((el) => getComputedStyle(el, '::after').content), 'none', 'orbital frame removed');
        assert.equal(await page.locator('.home-hero-title .accent-gradient').evaluate((el) => getComputedStyle(el).animationName), 'none', 'text gradient never blinks or repaints on a loop');
      } else {
        assert.notEqual(tilt, 'none', `${name}: pointer tilt is active`);
        assert.notEqual(tilt, 'matrix(1, 0, 0, 1, 0, 0)', `${name}: tilt is not the resting identity`);
      }
      if (anchor) {
        const after = await page.locator('.home-hero-visual').boundingBox();
        assert.equal(after.x, anchor.x);
        assert.equal(after.y, anchor.y);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const link = page.locator(home ? '.home-hero-actions a, .home-hero-work a' : '.profile-links a').first();
      if (await link.count()) {
        await link.focus();
        assert.equal(await link.evaluate((el) => document.activeElement === el), true);
      }
      await page.screenshot({ path: `/tmp/raksara-dramatic-${name}-${theme}.png` });
      await page.evaluate(() => window.scrollTo(0, 220));
      await page.waitForTimeout(250);
      const depth = await page.locator(home ? '.home-hero-visual' : '.profile-card').evaluate(
        (el, isHome) => isHome ? getComputedStyle(el, '::before').transform : getComputedStyle(el).translate, home
      );
      assert.notEqual(depth, 'none', `${name}: scroll depth is active`);
      if (home) {
        for (const kind of ['.portfolio-card', '.home-info-card-link']) {
          const wrapper = page.locator(`.home-card-depth:has(> ${kind})`).first();
          await wrapper.scrollIntoViewIfNeeded();
          const before = await wrapper.boundingBox();
          await page.mouse.move(before.x + before.width * .8, before.y + before.height * .3);
          await page.waitForTimeout(500);
          assert.notEqual(await wrapper.locator(kind).evaluate((el) => getComputedStyle(el).transform), 'none', 'linked card has depth');
          const after = await wrapper.boundingBox();
          assert(Math.abs(after.x - before.x) < .1 && Math.abs(after.y - before.y) < .1, 'card hit area does not move');
          assert.equal(await page.locator('.home-hero-copy').evaluate((el) => getComputedStyle(el).transform), 'none');
        }
      } else {
        const chip = page.locator('.profile-meta-chip').first();
        const before = await chip.boundingBox();
        await chip.hover();
        await page.waitForTimeout(350);
        assert.notEqual(await chip.locator('.meta-label').evaluate((el) => getComputedStyle(el).transform), 'none', 'metadata label lifts');
        const after = await chip.boundingBox();
        assert(Math.abs(after.x - before.x) < .1 && Math.abs(after.y - before.y) < .1, 'metadata hit area stays stationary');
        for (const link of await page.locator('.profile-links a').all()) {
          assert((await link.boundingBox()).height >= 44, 'profile links retain touch target size');
        }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      assert.equal(await hero.evaluate((el) => el.classList.contains('rk-pointer-depth')), false);
      assert.equal(await surface.evaluate((el) => getComputedStyle(el).transform), 'none', `${name}: live reduced motion is flat`);
      await page.close();
      console.log(`${name}/${theme}: stable hero/profile tilt, depth, keyboard access, portrait anchor, overflow and live reduced motion passed`);
    }

    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    mobile.on('pageerror', (error) => errors.push(error.message));
    await mobile.goto(new URL(route, base).href);
    await mobile.waitForFunction(() => document.querySelector('.rk-js-depth'));
    assert.equal(await mobile.locator('.rk-pointer-depth').count(), 0, 'touch must not activate tilt');
    const depthProp = home ? '--rk-home-halo-y' : '--rk-mobile-profile-card-y';
    const before = await mobile.locator(home ? '.home-hero' : '.profile-hero').evaluate((el, prop) => el.style.getPropertyValue(prop), depthProp);
    await mobile.evaluate(() => window.scrollTo(0, 220));
    await mobile.waitForTimeout(200);
    const after = await mobile.locator(home ? '.home-hero' : '.profile-hero').evaluate((el, prop) => el.style.getPropertyValue(prop), depthProp);
    assert.notEqual(after, before, 'mobile scrolling updates depth');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.screenshot({ path: `/tmp/raksara-dramatic-${name}-mobile.png` });
    await mobile.close();
    console.log(`${name}/mobile: scroll depth, no touch tilt and no overflow passed`);
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
} finally {
  await browser.close();
}
