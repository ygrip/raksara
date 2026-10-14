// MERGE_BASE_URL=http://127.0.0.1:5173 node scripts/test-merged-motion-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.MERGE_BASE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.body.classList.contains('sidebar-ready'));
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#theme-toggle').click();
    await page.waitForFunction((before) => document.documentElement.dataset.theme !== before, before);
    await page.waitForFunction(() => {
      const theme = document.documentElement.dataset.theme;
      const toggle = document.getElementById('theme-toggle');
      const active = toggle.querySelector(theme === 'dark' ? '.icon-moon' : '.icon-sun');
      const inactive = toggle.querySelector(theme === 'dark' ? '.icon-sun' : '.icon-moon');
      return getComputedStyle(active).opacity === '1' && getComputedStyle(inactive).opacity === '0';
    });
    await page.evaluate(async () => {
      const fixture = document.createElement('div');
      fixture.id = 'merged-motion-fixture';
      fixture.className = 'article-body';
      fixture.innerHTML = '<nav class="toc-block" data-open="true"><div class="toc-head"><button type="button" class="toc-toggle-btn" data-toc-target="merged-toc" aria-expanded="true">Contents</button></div><div class="toc-content" id="merged-toc"><div class="toc-content-inner"><ul class="toc-list"><li><a href="#merged-motion-fixture">Sample</a></li></ul></div></div></nav><pre><code>const answer = 42;</code></pre>';
      document.getElementById('content').appendChild(fixture);
      window.copyBlocked = true;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        async writeText(text) {
          if (window.copyBlocked) throw new Error('Clipboard permission denied by test');
          window.copiedText = text;
        },
      } });
      const { initArticleFeatures } = await import('/src/lib/markdown.ts');
      await initArticleFeatures(fixture);
    });
    const fixture = page.locator('#merged-motion-fixture');
    const toggle = fixture.locator('.toc-toggle-btn');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await fixture.locator('.toc-content').evaluate((el) => el.inert), true);
    await page.waitForFunction(() => document.getElementById('merged-toc').offsetHeight === 0);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await fixture.locator('.toc-content').evaluate((el) => el.inert), false);
    const copy = fixture.locator('.code-copy-btn');
    await copy.click();
    await page.locator('.code-toast.show').waitFor();
    assert.equal(await copy.evaluate((el) => el.classList.contains('copied')), false, 'denied clipboard access must not announce success');
    assert.equal(await page.locator('.code-toast').textContent(), 'Could not copy code');
    await page.evaluate(() => { window.copyBlocked = false; });
    await copy.click();
    await page.waitForFunction(() => window.copiedText === 'const answer = 42;');
    assert.equal(await copy.locator('.t-icon-swap').getAttribute('data-state'), 'b');
    await copy.click();
    await page.waitForFunction(() => document.querySelector('#merged-motion-fixture .t-icon-swap').dataset.state === 'a');
    await page.goto(new URL('/portfolio/', base).href);
    const card = page.locator('[data-tilt] .portfolio-card').first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4);
    if (reducedMotion === 'no-preference') {
      await page.waitForFunction(() => document.querySelector('[data-tilt] .portfolio-card.is-tilt-active'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    assert.equal(await card.evaluate((el) => getComputedStyle(el).transform.startsWith('matrix3d')), false, 'reduced motion removes 3D tilt immediately');
    assert.equal(await page.locator('.t-tilt-glare:visible').count(), 0);
    console.log(`${reducedMotion}: theme swap, accessible accordion, clipboard failure/success/reset and reduced-motion portfolio tilt passed`);
    await page.close();
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} finally {
  await browser.close();
}
