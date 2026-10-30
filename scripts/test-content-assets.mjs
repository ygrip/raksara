import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveContentAssetPath } = require('./content-asset-path.cjs');

const examples = [
  ['/assets/images/blog/atlas-nusantara/hero-cover.webp', 'content/assets/images/blog/atlas-nusantara/hero-cover.webp'],
  ['assets/images/blog/atlas-nusantara/hero-cover.webp', 'content/assets/images/blog/atlas-nusantara/hero-cover.webp'],
  ['/content/assets/images/blog/atlas-nusantara/hero-cover.webp', 'content/assets/images/blog/atlas-nusantara/hero-cover.webp'],
  ['content/content/assets/images/hero.webp', 'content/assets/images/hero.webp'],
  ['/assets/images/hero.webp?v=123#preview', 'content/assets/images/hero.webp'],
  ['/blog/images/photo.webp', 'content/blog/images/photo.webp'],
  ['/favicon.svg', 'favicon.svg'],
  ['https://example.org/cover.webp', 'https://example.org/cover.webp'],
  ['//cdn.example.org/cover.webp', '//cdn.example.org/cover.webp'],
  ['data:image/webp;base64,abc', 'data:image/webp;base64,abc'],
  ['blob:https://example.org/123', 'blob:https://example.org/123'],
  ['', ''],
];
for (const [input, expected] of examples) {
  assert.equal(resolveContentAssetPath(input), expected, input);
}

// A metadata builder manifest lookup must find the same key regardless of how
// the author specified the local image path.
const manifest = { 'content/assets/images/blog/atlas-nusantara/hero-cover.webp': { variants: [{ path: 'content/.raksara-responsive/a.webp', width: 640 }] } };
for (const [input] of examples.slice(0, 3)) {
  assert.ok(manifest[resolveContentAssetPath(input)], `Manifest lookup failed for ${input}`);
}
console.log('Prerendered content asset path normalization passed.');
