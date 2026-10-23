/**
 * Markdown TabContainer parser and progressively enhanced tab interaction.
 * Content stays as Markdown until the shared Raksara renderer processes it.
 */
export interface TabEntry {
  attrs: Record<string, string>;
  content: string;
}
export interface TabGroup {
  attrs: Record<string, string>;
  tabs: TabEntry[];
}

function readAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return attrs;
}

/** Strip only shared authoring indentation; preserve intentional nested code levels. */
function normalizeTabBody(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const margin = nonEmpty.length
    ? Math.min(...nonEmpty.map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0))
    : 0;
  return lines.map((line) => line.trim() ? line.slice(margin) : '').join('\n');
}

function parseTabEntries(content: string): TabEntry[] {
  const tabs: TabEntry[] = [];
  const tags = /<\/?(?:tabcontainer|tab)\b[^>]*>/gi;
  let nestedContainers = 0;
  let active: { attrs: Record<string, string>; start: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(content)) !== null) {
    const text = match[0];
    const closing = /^<\//.test(text);
    if (/^<\/?tabcontainer\b/i.test(text)) {
      nestedContainers = Math.max(0, nestedContainers + (closing ? -1 : 1));
      continue;
    }
    if (nestedContainers !== 0) continue;
    if (closing && active) {
      tabs.push({ attrs: active.attrs, content: normalizeTabBody(content.slice(active.start, match.index)) });
      active = null;
    } else if (!closing && !active) {
      active = { attrs: readAttrs(text.slice(text.indexOf(' ') + 1, -1)), start: tags.lastIndex };
    }
  }
  return tabs;
}

/**
 * Extract outermost groups only. Nested TabContainers are handled recursively
 * when their parent tab content is passed back through renderMarkdown.
 */
export function preprocessTabContainers(source: string, storage: TabGroup[]): string {
  const tags = /<\/?tabcontainer\b[^>]*>/gi;
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  let previousEnd = 0;
  let attributes: Record<string, string> = {};
  let result = '';
  let match: RegExpExecArray | null;
  while ((match = tags.exec(source)) !== null) {
    if (!/^<\//.test(match[0])) {
      if (depth === 0) {
        start = match.index;
        bodyStart = tags.lastIndex;
        attributes = readAttrs(match[0].slice('<TabContainer'.length, -1));
      }
      depth++;
      continue;
    }
    if (!depth) continue;
    depth--;
    if (depth !== 0) continue;
    const tabs = parseTabEntries(source.slice(bodyStart, match.index));
    if (!tabs.length) continue;
    result += source.slice(previousEnd, start);
    storage.push({ attrs: attributes, tabs });
    result += '\n\n[[RAKSARA_TABS:' + (storage.length - 1) + ']]\n\n';
    previousEnd = tags.lastIndex;
  }
  return result + source.slice(previousEnd);
}

function safeColor(input: string | undefined): string | null {
  if (!input) return null;
  const color = input.trim();
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
    || /^[a-z][a-z-]*$/i.test(color)
    || /^var\(--[a-z0-9-]+\)$/i.test(color)
    || /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%]+\)$/i.test(color)) return color;
  return null;
}

function defaultIndex(group: TabGroup): number {
  const requested = group.attrs['active'] ?? group.attrs['default'] ?? '';
  if (/^\d+$/.test(requested)) return Math.max(0, Math.min(group.tabs.length - 1, Number(requested)));
  const found = group.tabs.findIndex((tab) =>
    (tab.attrs['id'] || tab.attrs['title'] || '').toLowerCase() === requested.toLowerCase());
  return found >= 0 ? found : 0;
}

/** Produce accessible, SSR-ready tab markup with the first tab initially visible. */
export function renderTabContainer(
  group: TabGroup,
  groupIndex: number,
  renderContent: (content: string) => string,
  icons: Record<string, string>,
  escape: (text: string) => string
): string {
  const mode = ['top', 'left', 'right', 'bottom'].includes(group.attrs['mode'])
    ? group.attrs['mode'] : 'top';
  const selected = defaultIndex(group);
  const rootId = 'rk-tabs-' + groupIndex;
  const fallbackColor = safeColor(group.attrs['color']) ?? 'var(--accent)';
  const list = group.tabs.map((tab, i) => {
    const title = escape(tab.attrs['title'] || 'Tab ' + (i + 1));
    const icon = (tab.attrs['icon'] || '').trim();
    const iconSvg = icons[icon.toLowerCase()];
    const iconHtml = !icon ? '' : iconSvg
      ? '<span class="rk-tab-icon" aria-hidden="true">' + iconSvg + '</span>'
      : /^[a-z][\w-]*$/i.test(icon)
        ? '<span class="rk-tab-icon rk-tab-icon-fallback" aria-hidden="true"></span>'
        : '<span class="rk-tab-icon" aria-hidden="true">' + escape(icon) + '</span>';
    const accent = safeColor(tab.attrs['color']) ?? fallbackColor;
    const active = i === selected;
    return '<button class="rk-tab-trigger" type="button" role="tab" id="' + rootId + '-tab-' + i +
      '" aria-controls="' + rootId + '-panel-' + i +
      '" aria-selected="' + active + '" tabindex="' + (active ? '0' : '-1') +
      '" style="--rk-tab-color:' + escape(accent) + '">' + iconHtml +
      '<span class="rk-tab-label">' + title + '</span></button>';
  }).join('');
  const panels = group.tabs.map((tab, i) => {
    return '<section class="rk-tab-panel" role="tabpanel" id="' + rootId + '-panel-' + i +
      '" aria-labelledby="' + rootId + '-tab-' + i + '" tabindex="0"' +
      (i === selected ? '' : ' hidden') + '>' + renderContent(tab.content) + '</section>';
  }).join('');
  return '<div class="rk-tab-container" data-position="' + mode + '">' +
    '<div class="rk-tab-list" role="tablist" aria-label="' +
      escape(group.attrs['label'] || 'Content tabs') + '" aria-orientation="' +
      (mode === 'left' || mode === 'right' ? 'vertical' : 'horizontal') + '">' + list + '</div>' +
    '<div class="rk-tab-content">' + panels + '</div></div>';
}

/** Replace whole Markdown tokens with tab groups after all other injections. */
export function injectTabContainers(
  html: string,
  storage: TabGroup[],
  renderContent: (content: string) => string,
  icons: Record<string, string>,
  escape: (text: string) => string
): string {
  return html.replace(/(?:<p>\s*)?\[\[RAKSARA_TABS:(\d+)\]\](?:\s*<\/p>)?/g, (_match, rawIndex: string) => {
    const index = Number(rawIndex);
    const group = storage[index];
    return group ? renderTabContainer(group, index, renderContent, icons, escape) : '';
  });
}

/** Called by initArticleFeatures; safe to call repeatedly and for nested groups. */
export function initTabContainers(root: HTMLElement, onChange?: (panel: HTMLElement) => void): void {
  root.querySelectorAll<HTMLElement>('.rk-tab-container').forEach((group) => {
    if (group.dataset['tabsInit'] === '1') return;
    const tablist = group.querySelector<HTMLElement>(':scope > .rk-tab-list');
    const content = group.querySelector<HTMLElement>(':scope > .rk-tab-content');
    if (!tablist || !content) return;
    const tabs = Array.from(tablist.children).filter((el): el is HTMLButtonElement =>
      el instanceof HTMLButtonElement && el.getAttribute('role') === 'tab');
    const panels = Array.from(content.children).filter((el): el is HTMLElement =>
      el instanceof HTMLElement && el.getAttribute('role') === 'tabpanel');
    if (!tabs.length || tabs.length !== panels.length) return;
    group.dataset['tabsInit'] = '1';
    function activate(index: number, focus = false) {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
      onChange?.(panels[index]);
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index));
      tab.addEventListener('keydown', (event: KeyboardEvent) => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        event.stopPropagation();
        activate(next, true);
      });
    });
  });
}
