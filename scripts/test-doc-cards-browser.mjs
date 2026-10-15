import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.DOCS_BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });

try {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('raksara-theme', value), theme);
    await page.goto(new URL('/doc/', base).href);
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);

    const cards = page.locator('.component-list .component-card');
    assert((await cards.count()) > 0, 'documentation entries should be present');
    const first = cards.first();
    assert.equal(await first.locator('.component-card-index').count(), 1, 'indexed documentation entry');
    assert.equal(await first.locator('.component-card-arrow svg').count(), 1, 'nonverbal navigation arrow');
    assert.equal(await first.locator('.component-card-icon, .component-card-footer, .component-card-link').count(), 0,
      'no redundant emoji, footer or See details CTA');
    assert(await first.getAttribute('href'), 'whole card remains a single link');
    const desktop = await page.locator('.component-list').evaluate(list => ({
      grid: getComputedStyle(list).display,
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length
    }));
    assert.equal(desktop.grid, 'grid', 'cards use responsive CSS grid');
    if (await cards.count() > 1) assert(desktop.columns >= 2, 'desktop documentation index has two columns');

    await first.focus();
    assert.equal(await first.evaluate(el => getComputedStyle(el).outlineStyle), 'solid',
      'keyboard focus is clearly visible');
    const firstTitle = (await first.locator('.component-card-title').innerText()).trim();
    const search = page.getByRole('searchbox', { name: 'Filter components' });
    await search.fill(firstTitle);
    assert(await cards.count() >= 1, 'search still filters entries');
    assert.equal(await page.locator('.component-list-filter-count').count(), 1,
      'search reports result count only while filtering');
    await search.fill('');
    assert.equal(await page.locator('.component-list-filter-count').count(), 0);

    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await first.evaluate(el => ({
      card: el.getBoundingClientRect().toJSON(),
      viewport: document.documentElement.clientWidth,
      arrow: el.querySelector('.component-card-arrow')?.getBoundingClientRect().toJSON()
    }));
    assert(mobile.card.width > 0 && mobile.card.right <= mobile.viewport + 1, 'card fits mobile rail');
    assert(mobile.arrow && mobile.arrow.right <= mobile.card.right, 'navigation arrow stays inside card');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'documentation page has no horizontal overflow');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await first.hover();
    assert.equal(await first.evaluate(el => getComputedStyle(el).transform), 'none',
      'reduced motion disables card lift');
    assert.deepEqual(errors, [], 'page has no client errors');
    await page.close();
    console.log(`documentation card polish passed in ${theme} theme`);
  }
} finally {
  await browser.close();
}
