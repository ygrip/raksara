import assert from 'node:assert/strict';
import test from 'node:test';
import {
  preprocessTabContainers,
  renderTabContainer,
  injectTabContainers,
  initTabContainers
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

test('keyboard, click and repeat initialization keep only one tab panel active', () => {
  class FakeElement {
    constructor(role = '') {
      this.attributes = { role };
      this.children = [];
      this.dataset = {};
      this.listeners = {};
      this.hidden = false;
      this.tabIndex = -1;
      this.focused = false;
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    focus() { this.focused = true; }
  }
  class FakeButton extends FakeElement {}
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeButton;

  const tabs = [new FakeButton('tab'), new FakeButton('tab'), new FakeButton('tab')];
  const panels = [new FakeElement('tabpanel'), new FakeElement('tabpanel'), new FakeElement('tabpanel')];
  const tablist = new FakeElement('tablist');
  tablist.children = tabs;
  const content = new FakeElement();
  content.children = panels;
  const group = new FakeElement();
  group.querySelector = (selector) => selector.includes('rk-tab-list') ? tablist : content;
  const root = { querySelectorAll: () => [group] };
  const changes = [];
  initTabContainers(root, (panel) => changes.push(panel));
  initTabContainers(root, () => assert.fail('Double-bound event handler'));
  assert.equal(group.dataset['tabsInit'], '1');
  const key = (name) => ({
    key: name,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  });

  const arrow = key('ArrowRight');
  tabs[0].listeners.keydown(arrow);
  assert.ok(arrow.prevented && arrow.stopped);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.deepEqual(panels.map((panel) => panel.hidden), [true, false, true]);
  assert.equal(tabs[1].focused, true);
  const end = key('End');
  tabs[1].listeners.keydown(end);
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  tabs[0].listeners.click();
  assert.deepEqual(panels.map((panel) => panel.hidden), [false, true, true]);
  assert.deepEqual(changes, [panels[1], panels[2], panels[0]]);
  delete globalThis.HTMLElement;
  delete globalThis.HTMLButtonElement;
});

test('dedents natural author indentation and preserves deeper code blocks', () => {
  const store = [];
  preprocessTabContainers(
    '<TabContainer><Tab title="Nested">\n' +
    '    ### Heading\n' +
    '    **Rich text**\n' +
    '        code block\n' +
    '    <panel type="info">Note</panel>\n' +
    '</Tab></TabContainer>', store);
  assert.equal(store[0].tabs[0].content,
    '### Heading\n**Rich text**\n    code block\n<panel type="info">Note</panel>');
});
