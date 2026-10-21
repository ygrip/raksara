import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAdEligibleContentPage, toAdsenseClientId } from '../sveltekit/src/lib/advertising.js';

for (const raw of ['pub-5501931731194817', 'ca-pub-5501931731194817', 'CA-PUB-5501931731194817']) {
  assert.equal(toAdsenseClientId(raw), 'ca-pub-5501931731194817');
}
for (const raw of ['', 'pub-0000000000', 'ca-pub-00000000', 'google.com, pub-5501931731194817, DIRECT, example', 'pub-123', 'pub-123abc', 'other']) {
  assert.equal(toAdsenseClientId(raw), '', `Invalid publisher ID: ${raw}`);
}

const article = { post: { slug: 'automation/testing', type: 'blog' }, renderedHtml: '<p>Real article body</p>' };
const project = { item: { slug: 'testara' }, renderedHtml: '<p>Project details</p>' };
assert.equal(isAdEligibleContentPage('/blog/post/automation/testing/', article), true);
assert.equal(isAdEligibleContentPage('/portfolio/testara/', project), true);
assert.equal(isAdEligibleContentPage('/blog/post/automation/other/', article), false, 'incorrect article slug');
assert.equal(isAdEligibleContentPage('/portfolio/other/', project), false, 'incorrect portfolio slug');
assert.equal(isAdEligibleContentPage('/blog/post/automation/testing/', { ...article, renderedHtml: '' }), false, 'no content');
assert.equal(isAdEligibleContentPage('/portfolio/testara/', { ...project, renderedHtml: '' }), false, 'no content');
for (const type of ['poem', 'novel', 'chapters', 'comic']) {
  assert.equal(isAdEligibleContentPage('/blog/post/automation/testing/', { ...article, post: { ...article.post, type } }), false, type);
}
for (const path of ['/', '/blog/', '/portfolio/', '/tag/java/', '/tag/?name=java', '/category/?name=engineering', '/categories/', '/tags/', '/gallery/', '/thoughts/', '/privacy/', '/admin/', '/search/', '/404/']) {
  assert.equal(isAdEligibleContentPage(path, article), false, `Excluded: ${path}`);
}
assert.equal(isAdEligibleContentPage('/blog/post/automation/testing/', null), false);

const shell = readFileSync(new URL('../sveltekit/src/routes/+layout.svelte', import.meta.url), 'utf8');
assert.match(shell, /<meta name="google-adsense-account" content=\{adsenseClientId\}/, 'SSR account verification');
assert.match(shell, /client=\$\{adsenseClientId\}/, 'provider uses ca-pub- client');
assert.match(shell, /isAdEligibleContentPage\(\$page\.url\.pathname, \$page\.data\)/, 'route and content guard');

console.log('AdSense client verification, provider route eligibility and template checks passed.');
