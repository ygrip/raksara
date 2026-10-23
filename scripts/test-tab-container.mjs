import assert from 'node:assert/strict';
import test from 'node:test';
import {
  preprocessTabContainers,
  renderTabContainer,
  injectTabContainers
} from '../sveltekit/src/lib/tab-container.ts';

const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

test('supports four positions and defaults invalid values to top', () => {
  for (const mode of ['top', 'left', 'right', 'bottom', 'invalid']) {
    const store = [];
    const input = '<TabContainer mode="' + mode + '"><Tab title="One">Alpha</Tab><Tab title="Two">Beta</Tab></TabContainer>';
    const token = preprocessTabContainers(input, store);
    assert.match(token, /RAKSARA_TABS:0/);
    assert.equal(store[0].tabs.length, 2);
    const html = renderTabContainer(store[0], 0, (text) => text, {}, escape);
    assert.match(html, new RegExp('data-position="' + (mode === 'invalid' ? 'top' : mode) + '"'));
    assert.equal((html.match(/role="tab"/g) || []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) || []).length, 2);
    assert.match(html, /aria-selected="true" tabindex="0"/);
    assert.match(html, /aria-selected="false" tabindex="-1"/);
    assert.match(html, /id="rk-tabs-0-panel-1"[^>]* hidden/);
  }
});

test('uses per-tab color and fallback accent while escaping titles and rejecting CSS injection', () => {
  const store = [];
  preprocessTabContainers('<TabContainer color="red"><Tab title="A &amp; B" color="#ffcc00" icon="book">A</Tab>' +
    '<Tab title="Safe" color="red;position:fixed" icon="🔥">B</Tab></TabContainer>', store);
  const html = renderTabContainer(store[0], 0, (text) => text, { book: '<svg></svg>' }, escape);
  assert.match(html, /--rk-tab-color:#ffcc00/);
  assert.match(html, /--rk-tab-color:red/);
  assert.doesNotMatch(html, /position:fixed/);
  assert.match(html, /<svg><\/svg>/);
  assert.match(html, /🔥/);
});

test('selects by id and supports groups nested inside parent tabs', () => {
  const source = '<TabContainer mode="left" default="code">' +
    '<Tab title="Intro" id="intro"><panel type="info">**Hi**</panel></Tab>' +
    '<Tab title="Code" id="code"><TabContainer mode="bottom">' +
    '<Tab title="A">One</Tab><Tab title="B">Two</Tab>' +
    '</TabContainer></Tab></TabContainer>';
  const store = [];
  const outerToken = preprocessTabContainers(source, store);
  assert.equal(store.length, 1, 'nested groups are deferred');
  assert.equal(store[0].tabs.length, 2);
  const nested = (body) => {
    const token = preprocessTabContainers(body, store);
    return injectTabContainers(token, store, nested, {}, escape);
  };
  const html = injectTabContainers(outerToken, store, nested, {}, escape);
  assert.equal(store.length, 2);
  assert.match(html, /data-position="left"/);
  assert.match(html, /data-position="bottom"/);
  assert.match(html, /role="tabpanel" id="rk-tabs-1-panel-1"/);
  assert.match(html, /rk-tabs-0-tab-1" aria-controls="rk-tabs-0-panel-1" aria-selected="true"/);
  assert.match(html, /<panel type="info">/);
});

test('ignores unmatched elements and retains surrounding prose', () => {
  const store = [];
  const source = 'Before\n\n<TabContainer><Tab>unfinished\n\nAfter';
  assert.equal(preprocessTabContainers(source, store), source);
  assert.equal(store.length, 0);
  const valid = 'Before <TabContainer><Tab title="Only">Yes</Tab></TabContainer> After';
  const token = preprocessTabContainers(valid, store);
  assert.match(token, /^Before /);
  assert.match(token, / After$/);
});
