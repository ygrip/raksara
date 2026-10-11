// Regression guards for the Heritage Glass loading path.
// Run: node scripts/test-heritage-perf.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../sveltekit/${path}`, import.meta.url), 'utf8');
const css = read('src/routes/heritage-glass.css');
const html = read('src/app.html');
const layout = read('src/routes/+layout.svelte');
const dots = read('src/lib/components/DotField.svelte');
const fireflies = read('src/lib/components/Fireflies.svelte');

assert.doesNotMatch(css, /ukiran-divider\.webp|--hg-divider/);
assert.doesNotMatch(css, /cormorant-garamond-latin-wght-italic\.woff2/);
assert.match(css, /\.home-section-header::after[\s\S]*?linear-gradient\(90deg, var\(--hg-accent-text\), transparent\)/);
assert.match(html, /rel="preload" href="\/fonts\/plus-jakarta-sans-latin-wght-normal\.woff2" as="font" type="font\/woff2" crossorigin="anonymous"/);
assert.match(html, /rel="preload" href="\/fonts\/cormorant-garamond-latin-wght-normal\.woff2" as="font" type="font\/woff2" crossorigin="anonymous"/);
// Fireflies stay deferred and compositor-only: no canvas, timers or RAF loop.
assert.match(layout, /import\('\$lib\/components\/Fireflies\.svelte'\)/);
assert.doesNotMatch(layout, /^\s*import Fireflies/m);
assert.doesNotMatch(fireflies, /<canvas|getContext|setTimeout|setInterval/);
assert.match(fireflies, /:root\[data-theme='light'\]\) \.fireflies-layer/);
// DotField inverts to an ink halftone in light mode.
assert.match(dots, /ink\[index\] = subject \*/);
assert.match(dots, /const INVERT_MS = /);
assert.match(layout, /await import\('\$lib\/components\/AgenticTools\.svelte'\)/);
assert.match(dots, /const spacing = bounds\.width < 640 \? 8 : 7\.5;/);
assert.match(dots, /const FRAME_MS = 1000 \/ 12;/);
assert.match(dots, /const FRAME_MS_ACTIVE = 1000 \/ 24;/);
console.log('Heritage Glass loading regression checks passed.');
