// POPUP_BASE_URL=http://127.0.0.1:5173 node scripts/test-popup-motion-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.POPUP_BASE_URL ?? 'http://127.0.0.1:5173';
const errors = [];
try {
	for (const reducedMotion of ['no-preference', 'reduce']) {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion });
		page.on('pageerror', (error) => errors.push(error.message));
		await page.route('**/search-index.json', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 750));
			await route.continue();
		});
		await page.goto(base);
		await page.waitForFunction(() => document.body.classList.contains('sidebar-ready'));
		await page.evaluate(() => {
			window.popupDurations = [];
			const until = performance.now() + 3000;
			const record = () => {
				const content = document.querySelector('.search-overlay-content');
				if (content) window.popupDurations.push(...content.getAnimations().map((a) => a.effect.getTiming().duration));
				if (performance.now() < until) requestAnimationFrame(record);
			};
			record();
		});
		await page.locator('.search-trigger').click();
		await page.locator('#search-overlay-input').waitFor();
		if (reducedMotion === 'no-preference') {
			await page.waitForFunction(() => window.popupDurations.includes(250));
			assert.equal(await page.evaluate(() => window.popupDurations.includes(250)), true, 'search opening uses 250ms motion');
		}
		await page.waitForTimeout(300);
		assert.equal(await page.locator('#search-overlay-input').evaluate((el) => el === document.activeElement), true);
		await page.keyboard.press('Shift+Tab');
		assert.equal(await page.locator('.search-overlay').evaluate((el) => el.contains(document.activeElement)), true);
		await page.keyboard.press('Escape');
		if (reducedMotion === 'no-preference') {
			assert.equal(await page.locator('.search-overlay').count(), 1, 'search survives close request');
			assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
		}
		await page.locator('.search-overlay').waitFor({ state: 'detached' });
		assert.equal(await page.evaluate(() => document.body.style.overflow), '');
		await page.waitForTimeout(800);
		assert.equal(await page.locator('.search-trigger').evaluate((el) => el === document.activeElement), true, 'late search initialization must not steal restored focus');
		await page.locator('.search-trigger').click();
		await page.locator('#search-overlay-input').waitFor();
		await page.keyboard.press('Escape');
		await page.keyboard.press('/');
		await page.waitForTimeout(300);
		assert.equal(await page.locator('.search-overlay').count(), 1, 'rapid reopen survives old outro');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.waitForFunction(() => document.querySelector('#search-overlay-input').placeholder === 'Search posts, projects, pages…');
		await page.waitForTimeout(250);
		assert.equal(await page.locator('#search-overlay-input').getAttribute('placeholder'), 'Search posts, projects, pages…', 'live reduced motion stops typewriter timers');
		await page.emulateMedia({ reducedMotion });
		await page.keyboard.press('Escape');
		await page.locator('.search-overlay').waitFor({ state: 'detached' });

		await page.locator('.search-trigger').click();
		await page.locator('#search-overlay-input').waitFor();
		await page.evaluate(() => document.querySelector('a.nav-link[href^="/profile"]').click());
		await page.waitForURL(/\/profile\/?$/);
		await page.locator('.search-overlay').waitFor({ state: 'detached' });
		assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'search navigation releases scroll lock');

		await page.goto(new URL('/gallery', base).href);
		await page.waitForFunction(() => document.body.classList.contains('sidebar-ready'));
		const card = page.locator('.gallery-card-img').first();
		if (await card.count()) {
			await card.click();
			await page.locator('.gallery-lightbox-overlay').waitFor();
			await page.waitForTimeout(300);
			const src = await page.locator('.glb-image').getAttribute('src');
			await page.keyboard.press('Escape');
			if (reducedMotion === 'no-preference') {
				assert.equal(await page.locator('.glb-image').getAttribute('src'), src, 'gallery retains image during exit');
			}
			await page.locator('.gallery-lightbox-overlay').waitFor({ state: 'detached' });
			assert.equal(await page.evaluate(() => document.body.style.overflow), '');
			await card.click();
			await page.locator('.gallery-lightbox-overlay').waitFor();
			await page.evaluate(() => document.querySelector('a.nav-link[href^="/profile"]').click());
			await page.waitForURL(/\/profile\/?$/);
			await page.locator('.gallery-lightbox-overlay').waitFor({ state: 'detached' });
			assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'gallery navigation/unmount releases scroll lock');
		} else throw new Error('Gallery fixture missing: browser check needs at least one item');

		await page.evaluate(async () => {
			const fixture = document.createElement('div');
			fixture.id = 'popup-mermaid-fixture';
			fixture.innerHTML = '<div class="rk-mermaid">graph TD; A-->B</div>';
			document.body.appendChild(fixture);
			window.mermaid = { initialize() {}, run({ nodes }) { nodes.forEach((node) => { node.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" /></svg>'; }); } };
			const { initMermaid } = await import('/src/lib/markdown.ts');
			await initMermaid(fixture);
			document.body.style.overflow = 'clip';
		});
		await page.locator('#popup-mermaid-fixture .mermaid-expand-btn').click();
		await page.waitForTimeout(300);
		await page.keyboard.press('Escape');
		if (reducedMotion === 'no-preference') assert.equal(await page.locator('.mermaid-viewer-canvas svg').count(), 1, 'SVG survives exit');
		await page.locator('.mermaid-viewer-overlay').waitFor({ state: 'detached' });
		assert.equal(await page.locator('#popup-mermaid-fixture svg').count(), 1);
		assert.equal(await page.locator('#popup-mermaid-fixture .mermaid-expand-btn').evaluate((el) => el === document.activeElement), true);
		assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip', 'restore prior overflow');
		await page.locator('#popup-mermaid-fixture .mermaid-expand-btn').click();
		await page.waitForTimeout(280);
		await page.keyboard.press('Tab');
		assert.equal(await page.locator('.mermaid-viewer-dialog').evaluate((el) => el.contains(document.activeElement)), true, 'Mermaid traps Tab');
		await page.keyboard.press('Escape');
		await page.evaluate(() => document.querySelector('#popup-mermaid-fixture .mermaid-expand-btn').click());
		await page.waitForTimeout(280);
		assert.equal(await page.locator('.mermaid-viewer-overlay').count(), 1, 'Mermaid reopen cancels pending exit');
		await page.evaluate(() => document.querySelector('#popup-mermaid-fixture').remove());
		await page.locator('.mermaid-viewer-overlay').waitFor({ state: 'detached' });
		assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip', 'unmount releases viewer');
		await page.evaluate(() => { document.body.style.overflow = ''; });

		await page.setViewportSize({ width: 375, height: 812 });
		await page.locator('.sidebar-toggle').click();
		await page.waitForTimeout(300);
		await page.keyboard.press('Escape');
		if (reducedMotion === 'no-preference') assert.equal(await page.locator('.sidebar-overlay').count(), 1, 'sidebar scrim survives exit');
		await page.locator('.sidebar-overlay').waitFor({ state: 'detached' });
		await page.waitForTimeout(180);
		await page.locator('.sidebar-toggle').click();
		await page.waitForTimeout(280);
		await page.keyboard.press('Escape');
		await page.evaluate(() => document.querySelector('.sidebar-toggle').click());
		await page.waitForTimeout(250);
		assert.equal(await page.locator('#sidebar').evaluate((el) => el.classList.contains('open')), true);
		assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'sidebar reopen cancels pending scroll release');
		await page.keyboard.press('/');
		await page.locator('#search-overlay-input').waitFor();
		await page.waitForTimeout(280);
		assert.equal(await page.locator('#sidebar').evaluate((el) => el.classList.contains('open')), false, 'opening search replaces the sidebar');
		assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'sidebar exit preserves search scroll ownership');
		await page.keyboard.press('Escape');
		await page.locator('.search-overlay').waitFor({ state: 'detached' });
		assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'search releases the shared scroll lock after sidebar handoff');
		await page.locator('.sidebar-overlay').waitFor({ state: 'detached' });
		await page.waitForTimeout(180);
		assert.equal(await page.evaluate(() => document.body.style.overflow), '');
		await page.close();
		console.log(`${reducedMotion}: search, gallery, Mermaid, sidebar lifecycle/focus/overflow passed`);
	}
	assert.deepEqual(errors, [], 'browser runtime errors');
} finally { await browser.close(); }
