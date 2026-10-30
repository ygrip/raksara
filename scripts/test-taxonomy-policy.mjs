import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  isHighlightedTag,
  isHighlightedCategory,
  isIndexableTaxonomyPath,
  isTaxonomyPath,
  normalizeTaxonomyPath,
  resolveTaxonomyPageSize,
  rewriteTaxonomyHref,
  taxonomyHref,
} from '../sveltekit/src/lib/taxonomy.js';

const config = {
  taxonomy: { highlighted_tags: ['java', 'java_backend'], highlighted_categories: ['engineering'] },
  category_topics: { engineering: { title: 'Engineering', intro: 'Original engineering tutorials and projects.' } },
  topics: { programming: { title: 'Presentation alone is not an opt-in' } },
};

for (const value of [undefined, null, 0, -1, 1.5, '15', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(resolveTaxonomyPageSize(value), 30);
}
for (const value of [1, 7, 30, 60, 120]) assert.equal(resolveTaxonomyPageSize(value), value);

assert.equal(taxonomyHref('tag', 'java', config), '/tag/java/');
assert.equal(taxonomyHref('tag', 'java_backend', config), '/tag/java_backend/');
assert.equal(taxonomyHref('category', 'engineering', config), '/category/engineering/');
assert.equal(isHighlightedCategory('engineering', config), true);
assert.equal(isHighlightedCategory('Engineering', config), false);
assert.equal(isHighlightedTag('java', config), true);
assert.equal(isHighlightedTag('Java', config), false, 'term identity is case-sensitive');
assert.equal(isHighlightedTag('programming', config), false, 'topic copy does not imply indexability');
assert.equal(isHighlightedTag('java', undefined), false);
assert.equal(isHighlightedTag('java', {}), false);

for (const term of ['Java', 'cucumber', 'café & code', 'spaces here', 'a+b', 'x&y', '#hash', '100%', '%2F', '中文', 'a/b', '__proto__']) {
  for (const kind of ['tag', 'category']) {
    const url = new URL(taxonomyHref(kind, term, config), 'https://example.com');
    assert.equal(url.pathname, `/${kind}/`);
    assert.equal(url.searchParams.get('name'), term, `${kind} query round-trips ${term}`);
    assert.equal(url.searchParams.size, 1, 'a term cannot inject additional parameters');
    assert.equal(url.hash, '', 'a term cannot inject a fragment');
  }
}
assert.equal(new URL(taxonomyHref('category', 'java', config), 'https://example.com').pathname, '/category/');
assert.equal(isIndexableTaxonomyPath('/category/engineering/', config), true);
assert.equal(rewriteTaxonomyHref('/category/engineering/?page=2', config), '/category/engineering/?page=2');

for (const pathname of ['/tag/java', '/tag/java/', 'tag/java/', '/tag/java_backend/']) {
  assert.equal(isIndexableTaxonomyPath(pathname, config), true, pathname);
}
for (const pathname of ['/', '/tag', '/tag/', '/category', '/category/', '/category/java/', '/category/Engineering/', '/tag/Java/', '/tag/programming/', '/tag/java/extra/', '/tag/%E0%A4%A/', '/tag/%6Aava%252F/']) {
  assert.equal(isIndexableTaxonomyPath(pathname, config), false, pathname);
}
for (const pathname of ['/tag/', '/tag/java/', '/category/', '/category/Engineering/']) {
  assert.equal(isTaxonomyPath(pathname), true);
}
for (const pathname of ['/tags/', '/categories/', '/tagged/', '/blog/post/java/']) {
  assert.equal(isTaxonomyPath(pathname), false);
}
assert.equal(normalizeTaxonomyPath('/tag/java///'), '/tag/java');
assert.equal(normalizeTaxonomyPath('/'), '/');
assert.equal(rewriteTaxonomyHref('/tag/java/?page=2#articles', config), '/tag/java/?page=2#articles');
for (const term of ['java', 'automation', 'programming']) {
  assert.equal(rewriteTaxonomyHref(`/tag/${term}/`, {}), `/tag/?name=${term}`, 'authored homepage links must use generated shells unless explicitly highlighted');
}
assert.equal(rewriteTaxonomyHref('/tag/caf%C3%A9%20%26%20code/?page=2#articles', config), '/tag/?name=caf%C3%A9+%26+code&page=2#articles');
assert.equal(rewriteTaxonomyHref('/category/a%2Fb/', config), '/category/?name=a%2Fb');
assert.equal(rewriteTaxonomyHref('/tag/%252F/', config), '/tag/?name=%252F', 'decode only once');
for (const href of ['https://example.com/tag/java/', '/tag/', '/tag/java/extra/', '/tag/%E0%A4%A/', '/blog/post/java/']) {
  assert.equal(rewriteTaxonomyHref(href, config), href);
}
const require = createRequire(import.meta.url);
const { PAGE_SIZE, buildTaxonomyData, validateHighlightedTags } = require('./taxonomy-data.cjs');
const posts = Array.from({ length: 65 }, (_, index) => ({
  title: `Post ${index}`, slug: `post-${index}`, section: 'blog', path: `content/blog/post-${index}.md`,
  date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
  tags: ['bulk', 'bulk'], category: 'Engineering', summary: 'Short summary',
  body: 'Not archive data', ogImage: { landscape: 'not-needed.jpg' },
}));
const image = { width: 100, height: 100, variants: [] };
const source = {
  posts,
  portfolio: [{ title: 'Project', slug: 'project', date: '2026-01-01', tags: ['mixed'], category: 'Engineering' }],
  thoughts: [{ title: 'Thought', slug: 'thought', date: '2026-01-02', body: 'Keep thought text', tags: ['mixed'], category: 'Thought-only' }],
  gallery: [{ title: 'Photo', slug: 'photo', date: '2026-01-03', tags: ['mixed', '__proto__', 'a/b'], category: 'Photography',
    image: '/media/photo.webp', images: [{ src: 'media/second.webp' }] }],
  imageManifest: { 'media/photo.webp': image, 'media/second.webp': image, unrelated: image },
};
const built = buildTaxonomyData(source);
assert.equal(PAGE_SIZE, 30);
assert.equal(built.index.tags.bulk.total, 65, 'duplicate tags do not duplicate results');
assert.equal(built.index.tags.bulk.pages, 3);
assert.equal(built.index.categories.Engineering.total, 66);
assert.equal(Object.hasOwn(built.index.categories, 'Thought-only'), false, 'category scope excludes thoughts');
assert.equal(built.index.tags.mixed.total, 3, 'tag scope includes project, thought and gallery');
assert.equal(Object.hasOwn(built.index.tags, '__proto__'), true, 'prototype-shaped terms are ordinary registry keys');
assert.equal(Object.getPrototypeOf(built.index.tags), Object.prototype, 'terms cannot alter the registry prototype');
assert.match(built.index.tags['a/b'].id, /^[a-f0-9]{32}$/);
const bulkId = built.index.tags.bulk.id;
for (const [page, expected] of [[1, 30], [2, 30], [3, 5]]) {
  const result = built.pages.get(`tag/${bulkId}/${page}.json`);
  assert.equal(result.posts.length, expected);
  assert.equal(result.total, 65);
  assert.equal(result.page, page);
  assert.equal(Object.hasOwn(result.posts[0], 'body'), false);
  assert.equal(Object.hasOwn(result.posts[0], 'ogImage'), false);
  assert.deepEqual(result.imageManifest, {}, 'unrelated images are never included');
}
assert.equal(built.pages.get(`tag/${bulkId}/1.json`).posts[0].slug, 'post-64', 'results are newest first');
assert.equal(posts[0].slug, 'post-0', 'generator does not reorder source arrays');
const mixed = built.pages.get(`tag/${built.index.tags.mixed.id}/1.json`);
assert.equal(mixed.thoughts[0].body, 'Keep thought text');
assert.deepEqual(Object.keys(mixed.imageManifest).sort(), ['media/photo.webp', 'media/second.webp']);
const rebuilt = buildTaxonomyData({ ...source, posts: [...posts].reverse() });
assert.equal(rebuilt.index.tags.bulk.id, bulkId, 'term shard IDs are stable independently of input order');
assert.deepEqual(rebuilt.pages.get(`tag/${bulkId}/1.json`), built.pages.get(`tag/${bulkId}/1.json`));
assert.deepEqual(buildTaxonomyData({}).index.tags, {}, 'omitted highlights do not infer topic policy');
assert.doesNotThrow(() => validateHighlightedTags({ topics: { bulk: { title: 'Bulk' } } }, built.index));
const validConfig = { taxonomy: { highlighted_tags: ['bulk'] }, topics: { bulk: { title: 'Bulk', intro: 'Curated bulk archive.' } } };
assert.doesNotThrow(() => validateHighlightedTags(validConfig, built.index));
const validCategories = { taxonomy: { highlighted_categories: ['Engineering'] }, category_topics: { Engineering: { title: 'Engineering', intro: 'Hands-on experiments.' } } };
assert.doesNotThrow(() => validateHighlightedTags(validCategories, built.index));
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_categories: ['Engineering'] } }, built.index), /needs category_topics/);
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_categories: ['Engineering', 'Engineering'] } }, built.index), /duplicates/);
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_categories: ['missing'] } }, built.index), /no visible content/);
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_categories: ['a/b'] } }, built.index), /safe category slugs/);
assert.throws(() => validateHighlightedTags({ taxonomy: [] }, built.index), /taxonomy must be an object/);
for (const highlighted_tags of [null, 'bulk', ['bulk', 'bulk'], ['a/b'], ['not present'], ['__proto__']]) {
  assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_tags } }, built.index));
}
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_tags: ['missing'] } }, built.index), /no visible content/);
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_tags: ['bulk'] } }, built.index), /needs topics/);
assert.throws(() => validateHighlightedTags({ taxonomy: { highlighted_tags: ['bulk'] }, topics: { bulk: { title: 'Bulk', intro: ' ' } } }, built.index), /needs topics/);
assert.throws(() => buildTaxonomyData({ posts: [{ slug: 'invalid', tags: [123] }] }), /Invalid tag term/);
assert.throws(() => buildTaxonomyData({ posts: [{ slug: 'invalid', tags: 'java' }] }), /Invalid tags array/);
console.log('Taxonomy policy, URL encoding and bounded data generation checks passed.');
