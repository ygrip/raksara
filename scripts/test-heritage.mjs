import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Heritage motifs use transparent original SVG assets', () => {
  for (const motif of ['kawung', 'ukiran', 'mega-mendung']) {
    const svg = read('sveltekit/static/heritage/' + motif + '.svg');
    assert.match(svg, /<svg[^>]+viewBox=/);
    assert.match(svg, /fill="none"/);
    assert.match(svg, /<\/svg>/);
  }
});

test('Ornament tokens inherit accent and both themes', () => {
  const css = read('sveltekit/src/routes/heritage.css');
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /data-theme="light"/);
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /prefers-reduced-transparency/);
  assert.match(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /#[a-f\d]{6}\b/i, 'ornament colors must stay theme-neutral');
});

test('Homepage keeps DotField with an opt-in ornament', () => {
  const home = read('sveltekit/src/routes/+page.svelte');
  assert.match(home, /<DotField\b/);
  assert.match(home, /<HeritageOrnament\b/);
  assert.match(home, /home-hero-content heritage-frame/);
  const layout = read('sveltekit/src/routes/+layout.svelte');
  assert.match(layout, /import '\.\/heritage\.css'/);
});
