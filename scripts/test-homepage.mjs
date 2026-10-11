// Run against dev/preview: HOMEPAGE_BASE_URL=http://localhost:5173 node scripts/test-homepage.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.HOMEPAGE_BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const config = await (await fetch(`${base}/metadata/homepage.json`)).json();
  assert.ok(html.includes('application/ld+json'), 'structured data remains in static HTML');
  for (const link of config.hero?.links ?? []) {
    assert.ok(html.includes(`href="${link.href}"`), `crawlable project reference: ${link.href}`);
    assert.equal((await fetch(new URL(link.href, base))).status, 200);
  }

  for (const theme of ['dark', 'light']) {
    for (const width of [375, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((value) => localStorage.setItem('raksara-theme', value), theme);
      await page.goto(base);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.title(), config.seo.title);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), config.seo.description);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('.home-hero-title').textContent(), config.hero.title);
      assert.equal(await page.locator('.home-hero-actions a').count(), config.hero.actions.length);
      assert.equal(await page.locator('.home-hero-work a').count(), config.hero.links?.length ?? 0);
      await page.locator('.hero-dot-field canvas').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme}/${width}: no horizontal overflow`);

      for (const link of await page.locator('.home-hero-actions a, .home-hero-work a').all()) {
        const box = await link.boundingBox();
        assert.ok(box && box.height >= 44, `${theme}/${width}: usable link target`);
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${theme}/${width}: link fits viewport`);
      }
      if (config.hero.links?.length) {
        const link = page.locator('.home-hero-work a').first();
        await link.focus();
        assert.equal(await link.evaluate((el) => getComputedStyle(el).outlineStyle), 'solid', 'visible keyboard focus');
      }
      await page.locator('.home-hero-title').click();
      await page.screenshot({ path: `/tmp/raksara-home-${theme}-${width}.png` });
      await page.close();
      console.log(`Homepage ${theme}/${width}: hero, links, SEO, reduced motion, and viewport checks passed`);
    }
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
} finally {
  await browser.close();
}
