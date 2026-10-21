import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveAdsenseConfig, toAdsenseClientId, matchesAdPath, isAdsensePathEligible,
} from '../sveltekit/src/lib/advertising.js';

const publisher = 'pub-1234567890123456';
const client = `ca-${publisher}`;
const record = `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`;
const modern = {
  advertising: {
    adsense: {
      enabled: true,
      publisher_id: publisher,
      ads_txt: record,
      load_strategy: 'interaction',
      allowed_paths: ['/blog/post/**', '/portfolio/*'],
      excluded_paths: ['/blog/post/preview/**'],
    },
  },
};

for (const raw of [publisher, client, client.toUpperCase()]) {
  assert.equal(toAdsenseClientId(raw), client);
}
for (const raw of ['', 'pub-0000000000', 'ca-pub-00000000', 'pub-123', 'pub-123abc', 'other']) {
  assert.equal(toAdsenseClientId(raw), '', `Invalid ID: ${raw}`);
}

for (const config of [null, undefined, {}, { advertising: {} }, { advertising: { adsense: { enabled: false, publisher_id: publisher } } }]) {
  const settings = resolveAdsenseConfig(config);
  assert.equal(settings.enabled, false, 'AdSense is optional and disabled without explicit config');
  assert.equal(settings.clientId, '');
  assert.equal(settings.adsTxtLine, '');
}
assert.equal(resolveAdsenseConfig({ ...modern, advertising: { adsense: { publisher_id: publisher } } }).enabled, false, 'Modern setup needs enabled: true');
assert.equal(resolveAdsenseConfig({ adsense: record, advertising: { adsense: { enabled: false } } }).enabled, false, 'Explicit disable overrides legacy');
const settings = resolveAdsenseConfig(modern);
assert.equal(settings.enabled, true);
assert.equal(settings.clientId, client);
assert.equal(settings.publisherId, publisher);
assert.equal(settings.adsTxtLine, record);
assert.deepEqual(settings.allowedPaths, modern.advertising.adsense.allowed_paths);
assert.deepEqual(settings.excludedPaths, modern.advertising.adsense.excluded_paths);
assert.equal(settings.loadStrategy, 'interaction');
assert.equal(settings.allowLocalhost, false);
assert.equal(resolveAdsenseConfig({ advertising: { adsense: { enabled: true, publisher_id: client, load_strategy: 'immediate', allow_localhost: true } } }).loadStrategy, 'immediate');
assert.equal(resolveAdsenseConfig({ advertising: { adsense: { enabled: true, publisher_id: client, allow_localhost: true } } }).allowLocalhost, true);

const legacy = resolveAdsenseConfig({ adsense: record });
assert.equal(legacy.enabled, true, 'Keep legacy account verification');
assert.equal(legacy.clientId, client);
assert.equal(legacy.adsTxtLine, record);
assert.deepEqual(legacy.allowedPaths, [], 'Legacy config never automatically places ads');
assert.equal(isAdsensePathEligible('/blog/post/example', legacy), false);
assert.equal(resolveAdsenseConfig({ adsense: { publisher_id: publisher, enabled: false } }).enabled, false);
assert.equal(resolveAdsenseConfig({ advertising: { adsense: { enabled: true, publisher_id: publisher } } }).adsTxtLine, `google.com, ${publisher}, DIRECT`);

for (const [path, pattern, expected] of [
  ['/', '/', true], ['/blog/post/example/', '/blog/post/*', true],
  ['/blog/post/series/example/', '/blog/post/*', false],
  ['/blog/post/series/example/', '/blog/post/**', true],
  ['/blog/post/', '/blog/post/**', true],
  ['/portfolio/example/', '/portfolio/*', true],
  ['/portfolio/example/test/', '/portfolio/*', false],
  ['/tag/java/', '/blog/post/**', false],
  ['/x', 'x', false], ['/foo/bar', '/foo/ba*', false],
]) {
  assert.equal(matchesAdPath(path, pattern), expected, `Pattern ${pattern} on ${path}`);
}
for (const path of ['/blog/post/hello/', '/blog/post/nested/chapter/', '/portfolio/example/']) {
  assert.equal(isAdsensePathEligible(path, settings), true, path);
}
for (const path of ['/', '/blog/', '/portfolio/', '/tag/java/', '/category/?name=engineering', '/blog/post/preview/one', '/portfolio/nested/path', '/privacy/', '/404/']) {
  assert.equal(isAdsensePathEligible(path, settings), false, path);
}

const shell = readFileSync(new URL('../sveltekit/src/routes/+layout.svelte', import.meta.url), 'utf8');
assert.match(shell, /<meta name="google-adsense-account" content=\{adsenseSettings.clientId\}/, 'Account metadata stays SSR');
assert.match(shell, /client=\$\{settings.clientId\}/, 'Provider script uses normalized client ID');
assert.match(shell, /isAdsensePathEligible\(\$page\.url\.pathname, settings\)/, 'No engine-owned ad route list');
console.log('Optional AdSense configuration, legacy compatibility and per-site paths verified.');
