import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const matter = require('gray-matter');
const { normalizeContentDate } = require('./content-date.cjs');

assert.equal(normalizeContentDate(new Date('2026-10-21T00:00:00.000Z')), '2026-10-21');
assert.equal(normalizeContentDate('2026-10-21'), '2026-10-21');
assert.equal(normalizeContentDate('2026-10-21T00:00:00.000Z'), '2026-10-21');
assert.equal(normalizeContentDate(undefined), undefined);
assert.equal(normalizeContentDate(''), undefined);
assert.equal(normalizeContentDate('not a date'), undefined);
assert.equal(normalizeContentDate(20261021), undefined);
assert.equal(normalizeContentDate(new Date('invalid')), undefined);

// Reproduce the actual source of the production failure: gray-matter parses
// unquoted YAML dates as Date objects rather than strings.
const parsed = matter(`---
title: Example project
date: 2026-03-06
updated: 2026-10-21
---
Example body
`);
assert.ok(parsed.data.updated instanceof Date);
const meta = Object.fromEntries(['date', 'updated'].map(key => [key, normalizeContentDate(parsed.data[key])]));
assert.equal(meta.date, '2026-03-06');
assert.equal(meta.updated, '2026-10-21');
const entries = [
  { date: '2026-01-20', title: 'Older' },
  { date: meta.date, updated: meta.updated, title: 'Updated recently' },
  { date: '2026-07-01', title: 'Another' },
];
entries.sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));
assert.deepEqual(entries.map(entry => entry.title), ['Updated recently', 'Another', 'Older']);
console.log('YAML frontmatter date normalization and carousel ordering passed.');

// The metadata builder may be run with any site, including one without a
// profile. Enforce that a published profile never silently lacks its payload.
if (process.argv.includes('--verify-generated')) {
  const base = join(import.meta.dirname, '..');
  const pagesFile = join(base, 'metadata/pages.json');
  if (!existsSync(pagesFile)) throw new Error('Generate metadata before --verify-generated');
  const pages = JSON.parse(readFileSync(pagesFile, 'utf8'));
  if (pages.some(page => page.slug === 'profile')) {
    const filepath = join(base, 'sveltekit/static/metadata/profile-prerender.json');
    if (!existsSync(filepath)) throw new Error('Published profile is missing profile-prerender.json');
    const profile = JSON.parse(readFileSync(filepath, 'utf8'));
    if (typeof profile.html !== 'string' || !profile.html.trim()) {
      throw new Error('Published profile has an empty prerendered body');
    }
    // The profile embeds custom prerendered carousels, which must resolve
    // relative authored covers to the publicly served /content/ directory.
    const carouselImages = [...profile.html.matchAll(/<div class="content-carousel-img\b[^>]*>\s*<img\b([^>]+)>/g)];
    for (const [, attributes] of carouselImages) {
      const src = attributes.match(/\bsrc="([^"]+)"/)?.[1] || '';
      if (!src || /^\/?(?:assets|blog|gallery|pages|portfolio|thoughts)\//.test(src)) {
        throw new Error(`Profile carousel has an invalid cover URL: ${src}`);
      }
    }
  }
  console.log('Generated profile artifact matches configured publication state.');
}
