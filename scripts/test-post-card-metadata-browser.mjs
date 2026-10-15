import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The novel listing contains a post with date, ongoing status, category and tags.
// POST_CARD_META_PATH lets this regression run against another fixture.
const base = process.env.POST_CARD_META_BASE_URL ?? 'http://localhost:5173';
const path = process.env.POST_CARD_META_PATH ?? '/blog/dir/novel/';
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [320, 375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL(path, base).href);

    const card = page.locator('.post-list .post-card').filter({
      has: page.locator('.post-card-meta .status-chip')
    }).first();
    await card.waitFor();

    const result = await card.evaluate(el => {
      const body = el.querySelector('.post-card-body');
      const meta = el.querySelector('.post-card-meta');
      const date = meta?.querySelector('time');
      const status = meta?.querySelector('.status-chip');
      const category = meta?.querySelector('.post-card-category');
      const tags = el.querySelector('.post-card-tags');
      const tagNodes = [...(tags?.querySelectorAll('.tag') ?? [])];
      if (!body || !meta || !date || !status || !category || !tags || !tagNodes.length) return null;
      const bounds = node => node.getBoundingClientRect();
      return {
        body: bounds(body),
        date: bounds(date),
        status: bounds(status),
        category: bounds(category),
        tags: bounds(tags),
        tagBoxes: tagNodes.map(bounds),
        grid: getComputedStyle(meta).display,
        categoryOverflow: category.scrollWidth - category.clientWidth,
        metadataOverflow: meta.scrollWidth - meta.clientWidth,
        tagOverflow: tags.scrollWidth - tags.clientWidth
      };
    });

    assert(result, 'a post card should have date, status, category and tags');
    assert.equal(result.grid, 'grid', 'metadata uses separate grid rows');
    assert(Math.abs((result.date.top + result.date.height / 2) -
      (result.status.top + result.status.height / 2)) < 3,
      'date and status must be aligned on one line');
    assert(result.date.right + 3 <= result.status.left,
      'date and status must not overlap');
    assert(result.category.top >= Math.max(result.date.bottom, result.status.bottom) + 4,
      'category must be below the date/status row');
    assert(result.tags.top >= result.category.bottom + 4,
      'tags must be below the category');
    assert(result.category.right <= result.body.right + 1,
      'category must stay inside post body');
    assert(result.categoryOverflow <= 1 && result.metadataOverflow <= 1,
      'category text and metadata must never be truncated');
    assert(result.tagOverflow <= 1 && result.tagBoxes.every(tag =>
      tag.right <= result.body.right + 1),
      'tags must wrap within the card instead of being clipped or masked');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true, 'the page must not scroll horizontally');
    assert.deepEqual(errors, [], 'page should not produce runtime errors');
    await page.close();
    console.log(`post-card metadata layout passed at ${width}px`);
  }
} finally {
  await browser.close();
}
