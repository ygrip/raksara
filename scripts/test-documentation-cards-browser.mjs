import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.DOC_CARDS_BASE_URL ?? 'http://localhost:5173';
const path = process.env.DOC_CARDS_PATH ?? '/documentation/';
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL(path, base).href);

    const list = page.locator('.component-list').first();
    await list.waitFor();
    const cards = list.locator('.component-card');
    await cards.first().waitFor();
    const count = await cards.count();
    assert(count > 1, 'documentation fixtures must include multiple entries');
    assert.equal(await cards.locator('.component-card-number').count(), count,
      'every card includes a scan-friendly index');
    assert.equal(await cards.locator('.component-card-arrow').count(), count,
      'every card has one directional affordance');
    assert.equal(await cards.locator('.component-card-footer, .component-card-link, .component-card-icon, .status-available').count(), 0,
      'generic badges, decorative icons and repetitive footer CTAs stay removed');

    const layout = await list.evaluate(el => {
      const styles = getComputedStyle(el);
      const cards = [...el.querySelectorAll('.component-card')].map(card => ({
        rect: card.getBoundingClientRect(),
        display: getComputedStyle(card).display,
        href: card.getAttribute('href'),
        title: card.querySelector('.component-card-title')?.textContent?.trim()
      }));
      return {
        grid: styles.display,
        columns: styles.gridTemplateColumns.split(' ').length,
        listWidth: el.getBoundingClientRect().width,
        cards
      };
    });
    assert.equal(layout.grid, 'grid', 'documentation uses a responsive grid');
    assert(layout.cards.every(card => card.display !== 'none' && card.href && card.title),
      'all visible cards are complete navigable links');
    assert.equal(layout.columns, layout.listWidth >= 640 ? 2 : 1,
      'grid becomes two columns only when enough container space exists');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'documentation layout must not overflow the viewport');

    const first = cards.first();
    await first.focus();
    assert.equal(await first.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), true,
      'keyboard focus has a visible outline');
    const originalTitle = await first.locator('.component-card-title').innerText();
    const search = page.locator('.component-list-search').first();
    await search.fill('unlikely-no-such-component-xyz');
    await page.waitForTimeout(100);
    assert.equal(await cards.filter({ visible: true }).count(), 0, 'search hides non-matches');
    assert.equal(await page.locator('.component-list-empty').first().isVisible(), true,
      'search shows a useful empty state');
    await search.fill('');
    await page.waitForTimeout(100);
    assert.equal(await cards.filter({ visible: true }).count(), count, 'clearing search restores cards');
    assert.equal(await cards.first().locator('.component-card-title').innerText(), originalTitle);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const anim = await cards.first().evaluate(el => ({
      duration: getComputedStyle(el).transitionDuration,
      arrowDuration: getComputedStyle(el.querySelector('.component-card-arrow')).transitionDuration
    }));
    assert(anim.duration.split(',').every(v => v.trim() === '0s') &&
      anim.arrowDuration.split(',').every(v => v.trim() === '0s'),
      'reduced motion disables hover lift and arrow movement');

    assert.deepEqual(errors, [], 'documentation page should not throw runtime errors');
    console.log(`documentation cards passed at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
