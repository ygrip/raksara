// Run against a running dev/preview server: TAXONOMY_BASE_URL=http://localhost:5173 npm run test:taxonomy
// Install the browser once with: npx playwright install chromium
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolveTaxonomyPageSize } from '../sveltekit/src/lib/taxonomy.js';

for (const value of [undefined, null, 0, -1, 1.5, '15', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(resolveTaxonomyPageSize(value), 30, `invalid page size ${value} defaults to 30`);
}
for (const value of [1, 7, 30, 60, 120]) {
  assert.equal(resolveTaxonomyPageSize(value), value, 'positive integers configure page size');
}

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
  assert.equal(await chips.count(), 30, 'SSR/hydration mounts at most 30 tags');
  assert.equal(await previous.isDisabled(), true);
  const first = await chips.first().textContent();
  await next.click();
  await eventually(async () => assert.match(page.url(), /page=2/));
  assert.ok(await chips.count() <= 30);
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
    await eventually(async () => assert.equal(await chips.count(), 30));
    assert.equal(await previous.isDisabled(), true);
    await next.click();
    await eventually(async () => assert.match(page.url(), /page=2/));
    assert.equal(await chips.count(), 30, 'paging replaces rather than appends terms');

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
    await eventually(async () => assert.equal(await chips.count(), 30));
    await page.getByRole('combobox').selectOption('za');
    await eventually(async () => assert.match(await chips.first().textContent(), /term-09999/));
    assert.ok(page.url().includes('sort=za'));
    await page.getByRole('combobox').selectOption('popular');
    await eventually(async () => assert.match(await chips.first().textContent(), /term-00000/));
    await page.getByRole('searchbox').fill('term-000');
    await eventually(async () => assert.match(await page.locator('.taxonomy-result-count').textContent(), /100 of 10000/));
    for (let targetPage = 2; targetPage <= 4; targetPage++) {
      await next.click();
      await eventually(async () => assert.equal(new URL(page.url()).searchParams.get('page'), String(targetPage)));
    }
    await eventually(async () => assert.equal(await chips.count(), 10));
    assert.equal(await next.isDisabled(), true, 'last page cannot advance');
    await page.getByRole('searchbox').press('Escape');
    await eventually(async () => assert.equal(await chips.count(), 30));
  }

  await page.unrouteAll();
  await page.goto(`${base}/tags/?page=999999&sort=az#taxonomy-results`);
  await page.waitForLoadState('networkidle');
  assert.ok(await chips.count() > 0 && await chips.count() <= 30, 'out-of-range page clamps');
  assert.equal(await next.isDisabled(), true);
  await previous.click();
  assert.equal(new URL(page.url()).hash, '#taxonomy-results', 'URL updates preserve hash');
  // Override the serialized config fetch on hydration, leaving content files untouched.
  for (const [configured, expected] of [[7, 7], [0, 30]]) {
    const configuredPage = await browser.newPage();
    configuredPage.on('pageerror', (error) => errors.push(error.message));
    await configuredPage.route('**/metadata/config.json*', async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      config.taxonomy_page_size = configured;
      await route.fulfill({ response, json: config });
    });
    await configuredPage.route('**/tags/', async (route) => {
      const response = await route.fetch();
      let replaced = false;
      const body = (await response.text()).replace(
        /(<script type="application\/json" data-sveltekit-fetched data-url="[^"]*config\.json[^"]*">)([\s\S]*?)(<\/script>)/,
        (_, open, json, close) => {
          const payload = JSON.parse(json);
          const config = JSON.parse(payload.body);
          config.taxonomy_page_size = configured;
          payload.body = JSON.stringify(config);
          replaced = true;
          return open + JSON.stringify(payload).replaceAll('<', '\\u003c') + close;
        }
      );
      assert.ok(replaced, 'config fetch is serialized for hydration');
      await route.fulfill({ response, body });
    });
    await configuredPage.goto(`${base}/tags/`);
    await configuredPage.waitForLoadState('networkidle');
    assert.equal(await configuredPage.locator('#taxonomy-results .blog-dir-chip').count(), expected,
      'content config controls rendered page size, with invalid values falling back to 30');
    await configuredPage.close();
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Taxonomy pagination browser checks passed.');
} finally {
  await browser.close();
}
