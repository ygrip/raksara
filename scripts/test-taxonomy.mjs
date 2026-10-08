// Run against a running dev/preview server: TAXONOMY_BASE_URL=http://localhost:5173 npm run test:taxonomy
// Install the browser once with: npx playwright install chromium
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TAXONOMY_BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const chips = page.locator('#taxonomy-results .blog-dir-chip');
const next = page.getByRole('button', { name: 'Next', exact: true });
const previous = page.getByRole('button', { name: 'Previous', exact: true });

async function eventually(check) {
  const deadline = Date.now() + 10_000;
  while (true) {
    try { await check(); return; }
    catch (error) {
      if (Date.now() >= deadline) throw error;
      await page.waitForTimeout(25);
    }
  }
}

async function navigate(path) {
  // Exercise SvelteKit client navigation (including intercepted metadata fetches).
  await page.evaluate((href) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = 'Test navigation';
    document.body.append(link);
    link.click();
  }, path);
  await page.waitForURL(`${base}${path}`);
}

try {
  await page.goto(`${base}/tags/`);
  await page.waitForLoadState('networkidle');
  assert.equal(await chips.count(), 60, 'SSR/hydration mounts at most 60 tags');
  assert.equal(await previous.isDisabled(), true);
  const first = await chips.first().textContent();
  await next.click();
  await eventually(async () => assert.match(page.url(), /page=2/));
  assert.ok(await chips.count() <= 60);
  assert.notEqual(await chips.first().textContent(), first);
  await page.reload();
  await page.waitForLoadState('networkidle');
  assert.notEqual(await chips.first().textContent(), first, 'page survives reload');

  // Thousands of terms demonstrate bounded DOM work independently of site content.
  const fixture = Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => [
    `term-${String(index).padStart(5, '0')}`, 10_000 - index
  ]));
  await page.route('**/metadata/tags.json*', (route) => route.fulfill({ json: fixture }));
  await page.route('**/metadata/categories.json*', (route) => route.fulfill({ json: fixture }));
  await navigate('/categories/');
  await eventually(async () => assert.match(await page.locator('.taxonomy-result-count').textContent(), /of 10000/));

  for (const path of ['/categories/', '/tags/']) {
    if (!page.url().endsWith(path)) await navigate(path);
    await eventually(async () => assert.equal(await chips.count(), 60));
    assert.equal(await previous.isDisabled(), true);
    await next.click();
    await eventually(async () => assert.match(page.url(), /page=2/));
    assert.equal(await chips.count(), 60, 'paging replaces rather than appends terms');

    const started = Date.now();
    await page.getByRole('searchbox').fill('TERM-09999');
    await eventually(async () => assert.equal(await chips.count(), 1));
    assert.match(await chips.first().textContent(), /term-09999/);
    assert.ok(!page.url().includes('page='), 'search resets page');
    assert.equal(await page.locator('mark').textContent(), 'term-09999');
    console.log(`${path}: search across 10,000 terms settled in ${Date.now() - started}ms; rendered 1 match`);

    await page.getByRole('searchbox').fill('no-such-term');
    await eventually(async () => assert.equal(await chips.count(), 0));
    await page.getByRole('button', { name: 'Clear filter' }).click();
    await eventually(async () => assert.equal(await chips.count(), 60));
    await page.getByRole('combobox').selectOption('za');
    await eventually(async () => assert.match(await chips.first().textContent(), /term-09999/));
    assert.ok(page.url().includes('sort=za'));
    await page.getByRole('combobox').selectOption('popular');
    await eventually(async () => assert.match(await chips.first().textContent(), /term-00000/));
    await page.getByRole('searchbox').fill('term-000');
    await eventually(async () => assert.match(await page.locator('.taxonomy-result-count').textContent(), /100 of 10000/));
    await next.click();
    await eventually(async () => assert.equal(await chips.count(), 40));
    assert.equal(await next.isDisabled(), true, 'last page cannot advance');
    await page.getByRole('searchbox').press('Escape');
    await eventually(async () => assert.equal(await chips.count(), 60));
  }

  await page.unrouteAll();
  await page.goto(`${base}/tags/?page=999999&sort=az#taxonomy-results`);
  await page.waitForLoadState('networkidle');
  assert.ok(await chips.count() > 0 && await chips.count() <= 60, 'out-of-range page clamps');
  assert.equal(await next.isDisabled(), true);
  await previous.click();
  assert.equal(new URL(page.url()).hash, '#taxonomy-results', 'URL updates preserve hash');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Taxonomy pagination browser checks passed.');
} finally {
  await browser.close();
}
