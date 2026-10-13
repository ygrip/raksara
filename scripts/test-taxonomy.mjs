// Run against a running dev/preview server: TAXONOMY_BASE_URL=http://localhost:5173 npm run test:taxonomy
// Install the browser once with: npx playwright install chromium
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolveTaxonomyPageSize, taxonomyHref } from '../sveltekit/src/lib/taxonomy.js';

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

async function navigate(path, target = page) {
  // Exercise SvelteKit client navigation (including intercepted metadata fetches).
  await target.evaluate((href) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = 'Test navigation';
    document.body.append(link);
    link.click();
  }, path);
  await target.waitForURL(`${base}${path}`);
}

async function checkHybridArchives() {
  const configResponse = await page.request.get(`${base}/metadata/config.json`);
  const registryResponse = await page.request.get(`${base}/metadata/taxonomy/index.json`);
  assert.ok(configResponse.ok() && registryResponse.ok(), 'generated taxonomy config/registry are available');
  const config = await configResponse.json();
  const registry = await registryResponse.json();
  const highlighted = config.taxonomy?.highlighted_tags ?? [];
  const tail = Object.keys(registry.tags).find((term) => !highlighted.includes(term));
  const category = Object.keys(registry.categories)[0];
  const archive = await browser.newPage();
  archive.on('pageerror', (error) => errors.push(error.message));
  const requests = [];
  archive.on('request', (request) => requests.push(new URL(request.url()).pathname));
  const robots = archive.locator('head meta[name="robots"]');
  try {
    for (const [kind, term] of [['tag', tail], ['category', category]]) {
      if (!term) continue;
      const response = await archive.goto(`${base}${taxonomyHref(kind, term, config)}`);
      assert.equal(response.status(), 200, 'query archive has a physical HTML shell');
      await eventually(async () => {
        assert.equal(await robots.count(), 1);
        assert.equal(await robots.getAttribute('content'), 'noindex, follow');
        assert.ok(await archive.locator('.post-card, .portfolio-card, .thought-card, .gallery-card').count() > 0,
          'known term displays mixed-content results');
      });
      assert.equal(await archive.locator('head link[rel="canonical"]').count(), 0);
      await archive.reload();
      await eventually(async () => assert.ok(await archive.locator('.post-card, .portfolio-card, .thought-card, .gallery-card').count() > 0));
    }
    if (highlighted.length) {
      const term = highlighted[0];
      await archive.goto(`${base}/tag/?${new URLSearchParams({ name: term })}`);
      await archive.waitForURL(`${base}${taxonomyHref('tag', term, config)}`);
      await eventually(async () => assert.equal(await robots.getAttribute('content'), 'index, follow'));
      assert.equal(await archive.locator('head link[rel="canonical"]').count(), 1);
      assert.ok(await archive.locator('script[type="application/ld+json"]').count() > 0);
    }
    if (tail) {
      await archive.goto(`${base}/tag/${encodeURIComponent(tail)}/`);
      await archive.waitForURL(`${base}${taxonomyHref('tag', tail, config)}`);
      await eventually(async () => assert.equal(await robots.getAttribute('content'), 'noindex, follow'));
    }
    if (category) {
      await archive.goto(`${base}/category/${encodeURIComponent(category)}/`);
      await archive.waitForURL(`${base}${taxonomyHref('category', category, config)}`);
    }

    // Fixtures exercise unusual names and many matching items without altering site content.
    const nameA = 'Fixture & + % # 中文 / archive';
    const nameB = 'Fixture second';
    const idA = 'a'.repeat(32);
    const idB = 'b'.repeat(32);
    const fixtureRegistry = {
      version: 1,
      pageSize: 30,
      tags: { ...registry.tags, [nameA]: { id: idA, total: 65, pages: 3 }, [nameB]: { id: idB, total: 1, pages: 1 } },
      categories: registry.categories,
    };
    function resultPage(term, currentPage) {
      const total = term === nameA ? 65 : 1;
      const start = (currentPage - 1) * 30;
      return {
        kind: 'tag', term, page: currentPage, pageSize: 30, total, pages: Math.ceil(total / 30),
        posts: Array.from({ length: Math.min(30, total - start) }, (_, index) => ({
          title: `Taxonomy fixture ${term === nameA ? 'A' : 'B'} ${start + index + 1}`,
          slug: `taxonomy-fixture-${start + index + 1}`,
          section: 'blog', path: `content/blog/taxonomy-fixture-${start + index + 1}.md`,
          date: '2026-01-01', summary: 'A bounded taxonomy result.', tags: [term],
        })),
        portfolio: [], thoughts: [], gallery: [], imageManifest: {},
      };
    }
    await archive.route('**/metadata/taxonomy/index.json*', (route) => route.fulfill({ json: fixtureRegistry }));
    let failNext = false;
    let delayNext = false;
    await archive.route(`**/metadata/taxonomy/tag/${idA}/*.json*`, async (route) => {
      const pageNumber = Number(new URL(route.request().url()).pathname.match(/\/(\d+)\.json$/)[1]);
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, body: 'Temporary metadata failure' });
      }
      if (delayNext) {
        delayNext = false;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      await route.fulfill({ json: resultPage(nameA, pageNumber) });
    });
    await archive.route(`**/metadata/taxonomy/tag/${idB}/*.json*`, (route) => route.fulfill({ json: resultPage(nameB, 1) }));
    const pathA = taxonomyHref('tag', nameA, config);
    const pathB = taxonomyHref('tag', nameB, config);
    await archive.goto(`${base}${pathA}`);
    await eventually(async () => {
      assert.equal(await archive.locator('.post-card').count(), 30);
      assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture A 1$/);
    });
    assert.equal(new URL(archive.url()).searchParams.get('name'), nameA, 'encoded term round-trips without injection');
    await archive.getByRole('link', { name: 'Next', exact: true }).or(archive.getByRole('button', { name: 'Next', exact: true })).click();
    await eventually(async () => {
      assert.equal(new URL(archive.url()).searchParams.get('page'), '2');
      assert.equal(await archive.locator('.post-card').count(), 30);
      assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture A 31$/);
    });
    await navigate(pathB, archive);
    await eventually(async () => assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture B 1$/));
    await archive.goBack();
    await eventually(async () => assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture A 31$/));
    await archive.goForward();
    await eventually(async () => assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture B 1$/));

    // A failed page must not appear as an empty archive, and retry must recover.
    failNext = true;
    await navigate(`${pathA}&page=3`, archive);
    await archive.getByRole('alert').waitFor();
    await archive.getByRole('button', { name: /retry|try again/i }).click();
    await eventually(async () => {
      assert.equal(await archive.locator('.post-card').count(), 5);
      assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture A 61$/);
    });
    assert.equal(await archive.getByRole('alert').count(), 0, 'retry clears error status');

    for (const [path, copy] of [
      ['/tag/', /Choose a tag/i],
      ['/tag/?name=taxonomy-test-unknown-term', /No tag named/i],
      ['/tag/?name=one&name=two', /Invalid archive URL/i],
      [`${pathA}&page=1&page=2`, /Invalid archive URL/i],
    ]) {
      await navigate(path, archive);
      await eventually(async () => {
        assert.equal(await archive.locator('.post-card, .portfolio-card, .thought-card, .gallery-card').count(), 0);
        assert.equal(await robots.getAttribute('content'), 'noindex, follow');
        assert.match(await archive.locator('body').textContent(), copy);
      });
    }
    for (const invalidPage of ['-1', 'not-a-number', '999999']) {
      await navigate(`${pathA}&page=${invalidPage}`, archive);
      await eventually(async () => {
        const count = await archive.locator('.post-card').count();
        assert.ok(count > 0 && count <= 30, 'invalid/out-of-range detail page safely resolves to a bounded page');
      });
    }
    // A later term wins even if an earlier request takes longer.
    delayNext = true;
    await navigate(pathA, archive);
    await navigate(pathB, archive);
    await eventually(async () => assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture B 1$/));
    await archive.waitForTimeout(350);
    assert.match(await archive.locator('.post-card-title').first().textContent(), /fixture B 1$/);
    assert.ok(!requests.some((pathname) => /^\/metadata\/(posts|portfolio|thoughts|gallery|image-manifest)\.json$/.test(pathname)),
      'archive views never fetch full content collections or the full image manifest');
  } finally {
    await archive.close();
  }

  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await noJsContext.newPage();
  try {
    for (const kind of ['tag', 'category']) {
      const response = await noJs.goto(`${base}/${kind}/?name=anything`);
      assert.equal(response.status(), 200);
      assert.equal(await noJs.locator('meta[name="robots"]').count(), 1);
      assert.equal(await noJs.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
      assert.equal(await noJs.locator('link[rel="canonical"]').count(), 0);
      assert.match(await noJs.locator('body').textContent(), /JavaScript/i, 'no-JavaScript visitor receives an explanation');
    }
  } finally {
    await noJsContext.close();
  }
  console.log('Hybrid archive routing, bounded data, noindex, retry and no-JavaScript checks passed.');
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
  await checkHybridArchives();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Taxonomy directory and hybrid archive browser checks passed.');
} finally {
  await browser.close();
}
