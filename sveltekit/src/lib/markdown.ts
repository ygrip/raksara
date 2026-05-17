/**
 * Raksara SvelteKit Markdown Pipeline
 *
 * Renders Markdown plus Raksara custom components for the SvelteKit app.
 * Client-side only — import inside onMount / browser guards.
 *
 * Flow:
 *   1. Protect fenced code blocks from custom preprocessors
 *   2. Preprocess custom elements: file, toc, panel, container, chip, grid, progress
 *   3. Run marked.js with custom renderers (images, headings, links, code)
 *   4. Inject custom elements back into rendered HTML
 *   5. Post-process: sortable tables, hljs, chart.js, mermaid
 */

import type { ImageManifest } from './types';
import { buildResponsiveAttrs, responsiveAttrsToString } from './responsive-image';
import { assetUrl, formatDate } from './utils';

// ── Helpers ────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyHeading(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function resolveContentLink(href: string): string {
  if (
    !href ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith('/blog/post/') ||
    href.startsWith('/portfolio/') ||
    href.startsWith('/tag/') ||
    href.startsWith('/category/')
  )
    return href;

  const blogMatch = href.match(/^\/?(content\/)?blog\/(.+?)(?:#(.+))?$/);
  if (blogMatch) {
    const slug = blogMatch[2].replace(/\.md$/, '');
    return `/blog/post/${slug}${blogMatch[3] ? '#' + blogMatch[3] : ''}`;
  }
  const portfolioMatch = href.match(/^\/?(content\/)?portfolio\/(.+?)(?:#(.+))?$/);
  if (portfolioMatch) {
    const slug = portfolioMatch[2].replace(/\.md$/, '');
    return `/portfolio/${slug}${portfolioMatch[3] ? '#' + portfolioMatch[3] : ''}`;
  }
  const pageMatch = href.match(/^\/?(content\/)?pages\/(.+?)(?:#(.+))?$/);
  if (pageMatch) {
    const slug = pageMatch[2].replace(/\.md$/, '');
    return `/${slug}${pageMatch[3] ? '#' + pageMatch[3] : ''}`;
  }
  return href;
}

// ── Code-block vault (prevents custom preprocessors from touching code) ──

let _codeVault: string[] = [];

function vaultCode(md: string): string {
  _codeVault = [];
  return md
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, (m) => {
      _codeVault.push(m);
      return `\x02RAKSARA_CB_${_codeVault.length - 1}\x03`;
    })
    .replace(/`[^`\n]+`/g, (m) => {
      _codeVault.push(m);
      return `\x02RAKSARA_CB_${_codeVault.length - 1}\x03`;
    });
}

function restoreCode(s: string): string {
  return s.replace(/\x02RAKSARA_CB_(\d+)\x03/g, (_, i) => _codeVault[parseInt(i)] ?? '');
}

// ── File Attachments ───────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function getFileIconLabel(ext: string): { category: string; label: string } {
  const e = (ext || '').toLowerCase();
  const labelMap: Record<string, string> = {
    pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', ppt: 'PPT', pptx: 'PPT',
    zip: 'ZIP', rar: 'RAR', gz: 'GZ', tar: 'TAR', '7z': '7Z',
    jpg: 'JPG', jpeg: 'JPG', png: 'PNG', gif: 'GIF', svg: 'SVG', webp: 'WEBP',
    mp4: 'MP4', mov: 'MOV', mkv: 'MKV', webm: 'WEBM',
    mp3: 'MP3', wav: 'WAV', ogg: 'OGG', flac: 'FLAC',
    md: 'MD', txt: 'TXT', log: 'LOG',
    js: 'JS', ts: 'TS', py: 'PY', java: 'JAVA', go: 'GO', rs: 'RS',
    html: 'HTML', css: 'CSS', json: 'JSON', yml: 'YAML', yaml: 'YAML', sql: 'SQL',
  };
  const catMap: Record<string, string> = {
    pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt',
    zip: 'zip', rar: 'zip', gz: 'zip', tar: 'zip', '7z': 'zip',
    jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', svg: 'img', webp: 'img',
    mp4: 'video', mov: 'video', mkv: 'video', webm: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio',
  };
  return { category: catMap[e] ?? 'file', label: labelMap[e] ?? (e.toUpperCase().slice(0, 5) || 'FILE') };
}

function renderFileAttachment(filePath: string, displayName: string | null): string {
  const filename = displayName || filePath.split('/').pop() || filePath;
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : '';
  const { category, label } = getFileIconLabel(ext);
  const fs = label.length > 3 ? '7' : '9';
  const icon = `<svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.75" y="0.75" width="42.5" height="50.5" rx="5.25" fill="var(--bg-card)" stroke="var(--border-color)" stroke-width="1.5"/><path d="M27 1 L43 17 L27 17 Z" fill="var(--file-fold-color)" opacity="0.45"/><path d="M27 1 L27 17 L43 17" stroke="var(--border-color)" stroke-width="1.5" fill="none" stroke-linejoin="round"/><text x="22" y="37" text-anchor="middle" fill="var(--file-label-color)" font-weight="700" font-size="${fs}" font-family="system-ui,sans-serif" letter-spacing="0.8">${escapeHtml(label)}</text></svg>`;
  const href = filePath.startsWith('http') ? filePath : `/${filePath.replace(/^\//, '')}`;
  return `<div class="file-attachment-block"><a class="file-attachment" href="${escapeHtml(href)}" download data-ext="${escapeHtml(ext)}" data-category="${escapeHtml(category)}"><div class="file-attachment-icon">${icon}</div><div class="file-attachment-info"><span class="file-attachment-name">${escapeHtml(filename)}</span><span class="file-attachment-meta"><span class="file-attachment-badge">${escapeHtml(label)}</span><span class="file-attachment-size" data-size-url="${escapeHtml(href)}"></span></span></div><div class="file-attachment-dl"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5l3.5 4 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div></a></div>`;
}

function preprocessFileAttachments(md: string): string {
  return md.replace(/::file\[([^\]\n]+)\]/g, (_match, inner: string) => {
    const nameMatch = inner.match(/^(.*?)\s+"([^"]+)"$/);
    const filePath = (nameMatch ? nameMatch[1] : inner).trim();
    const displayName = nameMatch ? nameMatch[2] : null;
    if (!filePath) return _match;
    return renderFileAttachment(filePath, displayName);
  });
}

// ── Component Lists ───────────────────────────────────

let _componentStorage: string[] = [];
let _chaptersStorage: string[] = [];

function preprocessComponents(md: string): string {
  return md.replace(/::component\s*\(\s*([^)]+?)\s*\)/g, (_m, pathArg: string) => {
    _componentStorage.push(pathArg.trim());
    return `[[RAKSARA_COMPONENT:${_componentStorage.length - 1}]]`;
  });
}

function injectComponents(
  html: string,
  entries: Array<{ title?: string; slug?: string; path?: string; summary?: string; description?: string; icon?: string; status?: string }> = []
): string {
  if (_componentStorage.length === 0) return html;
  return html.replace(/(?:<p>)?\[\[RAKSARA_COMPONENT:(\d+)\]\](?:<\/p>)?/g, (_match, indexStr) => {
    const pathArg = _componentStorage[parseInt(indexStr, 10)] ?? '';
    const prefix = `content/${pathArg.replace(/^\/|\/$/g, '')}/`;
    const matching = entries.filter((entry) => entry.path?.startsWith(prefix));
    if (!matching.length) return '';
    const listId = `cl-${Math.random().toString(36).slice(2, 10)}`;
    const cards = matching
      .map((entry) => {
        const title = escapeHtml(entry.title || 'Untitled');
        const desc = escapeHtml(entry.summary || entry.description || '');
        const icon = entry.icon ? `<span class="component-card-icon">${escapeHtml(entry.icon)}</span>` : '';
        const status = entry.status || '';
        const statusClass = status ? ` status-${status.toLowerCase().replace(/\s+/g, '-')}` : '';
        const href = `/${entry.slug || ''}`;
        return `<a href="${escapeHtml(href)}" class="component-card glass" data-title="${escapeHtml((entry.title || '').toLowerCase())}" data-desc="${escapeHtml((entry.summary || entry.description || '').toLowerCase())}">
          <div class="component-card-header">${icon}<span class="component-card-title">${title}</span>${status ? `<span class="component-card-status${escapeHtml(statusClass)}">${escapeHtml(status)}</span>` : ''}</div>
          ${desc ? `<p class="component-card-desc">${desc}</p>` : ''}
          <div class="component-card-footer"><span class="component-card-link">See detail →</span></div>
        </a>`;
      })
      .join('');
    return `<div class="component-list-wrap"><div class="component-list-search-wrap"><input class="component-list-search" type="search" placeholder="Filter components..." aria-label="Filter components" data-list="${listId}"></div><div class="component-list" id="${listId}">${cards}</div></div>`;
  });
}

// ── Chapters Tables ───────────────────────────────────

function preprocessChapters(md: string): string {
  return md.replace(/::chapters\s*\(\s*([^)]+?)\s*\)/g, (_m, pathArg: string) => {
    _chaptersStorage.push(pathArg.trim());
    return `[[RAKSARA_CHAPTERS:${_chaptersStorage.length - 1}]]`;
  });
}

function normalizeChapterDir(pathArg: string): string {
  return pathArg
    .replace(/^#?\//, '')
    .replace(/^blog\//, '')
    .replace(/^content\/blog\//, '')
    .replace(/\/$/, '');
}

function injectChapters(
  html: string,
  context: RenderOptions['context'] = {}
): string {
  if (_chaptersStorage.length === 0) return html;
  return html.replace(/(?:<p>)?\[\[RAKSARA_CHAPTERS:(\d+)\]\](?:<\/p>)?/g, (_match, indexStr) => {
    const dir = normalizeChapterDir(_chaptersStorage[parseInt(indexStr, 10)] ?? '');
    const posts = context.posts ?? [];
    const blogDirs = context.blogDirs ?? {};
    const entry = blogDirs[dir];
    const subdirs = entry?.subdirs ?? [];
    const sortByChapterDate = (items: typeof posts) =>
      [...items].sort((a, b) => {
        const ca = parseInt(String(a.chapter ?? '')) || 0;
        const cb = parseInt(String(b.chapter ?? '')) || 0;
        return ca !== cb ? ca - cb : (a.date || '').localeCompare(b.date || '');
      });
    const directPosts = sortByChapterDate(posts.filter((post) => post.dir === dir));

    const iconDir = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44l.708.707A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>';
    const iconPage = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 2h5l3 3v9H4V2z" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.2"/></svg>';
    const iconChevron = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="chapters-chevron" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    let rows = '';
    for (const subdir of subdirs) {
      const subPath = `${dir}/${subdir}`;
      const subEntry = blogDirs[subPath];
      const childPosts = sortByChapterDate(posts.filter((post) => post.dir === subPath));
      const childCount = subEntry?.posts?.length ?? childPosts.length;
      const dirId = `chapters-${Math.random().toString(36).slice(2, 8)}`;
      rows += `<tr class="chapters-row chapters-row-dir" data-dir-id="${dirId}" data-expanded="false">
        <td class="chapters-cell-title"><span class="chapters-dir-toggle">${iconChevron}</span><span class="chapters-dir-name">${escapeHtml(subdir.replace(/-{2,}/g, ' – ').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}</span>${childCount ? `<span class="chapters-dir-badge">${childCount}</span>` : ''}</td>
        <td class="chapters-cell-date">—</td>
        <td class="chapters-cell-type chapters-type-dir" title="Directory">${iconDir}</td>
      </tr>`;
      for (const post of childPosts) {
        rows += `<tr class="chapters-row chapters-row-child" data-parent-dir="${dirId}" data-slug="${escapeHtml(post.slug)}" hidden>
          <td class="chapters-cell-title chapters-cell-indented">${escapeHtml(post.title)}</td>
          <td class="chapters-cell-date">${escapeHtml(formatDate(post.date))}</td>
          <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
        </tr>`;
      }
    }

    for (const post of directPosts) {
      rows += `<tr class="chapters-row chapters-row-page" data-slug="${escapeHtml(post.slug)}">
        <td class="chapters-cell-title">${escapeHtml(post.title)}</td>
        <td class="chapters-cell-date">${escapeHtml(formatDate(post.date))}</td>
        <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
      </tr>`;
    }

    if (!rows) rows = '<tr class="chapters-row"><td class="chapters-cell-empty" colspan="3">No data</td></tr>';
    return `<div class="chapters-block"><table class="chapters-table" role="table" aria-label="Chapter list for ${escapeHtml(dir)}"><thead><tr><th class="chapters-th chapters-th-sortable" data-col="title" data-order="" scope="col">Title</th><th class="chapters-th chapters-th-sortable chapters-th-date" data-col="date" data-order="" scope="col">Date</th><th class="chapters-th chapters-th-type" scope="col">Type</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
}

// ── TOC ───────────────────────────────────────────────

let _tocStorage: Array<{ type: string; maxLevel: number }> = [];

function preprocessToc(md: string): string {
  return md.replace(/::toc\s*\(\s*([^)]*)\s*\)/g, (_m, params) => {
    const raw = String(params ?? '').trim();
    let type = 'bullet';
    let maxLevel = 3;
    const typeMatch = raw.match(/(?:^|,)\s*type\s*=\s*(\w+)/i);
    const levelMatch = raw.match(/(?:^|,)\s*level\s*=\s*(\d+)/i);
    if (typeMatch || levelMatch) {
      if (typeMatch) type = typeMatch[1].toLowerCase();
      if (levelMatch) maxLevel = parseInt(levelMatch[1], 10);
    } else if (raw) {
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts[0]) type = parts[0].toLowerCase();
      if (parts[1]) maxLevel = parseInt(parts[1], 10);
    }
    if (type !== 'bullet' && type !== 'number') type = 'bullet';
    if (!Number.isFinite(maxLevel)) maxLevel = 3;
    maxLevel = Math.min(6, Math.max(1, maxLevel));
    _tocStorage.push({ type, maxLevel });
    return `[[RAKSARA_TOC:${_tocStorage.length - 1}]]`;
  });
}

function injectToc(html: string): string {
  if (!html.includes('[[RAKSARA_TOC:')) return html;
  const headings: Array<{ level: number; id: string; text: string }> = [];
  const re = /<h([1-6])[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    headings.push({ level: parseInt(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, '').trim() });
  }
  return html.replace(/(?:<p>)?\[\[RAKSARA_TOC:(\d+)\]\](?:<\/p>)?/g, (_match, idxStr) => {
    const idx = parseInt(idxStr);
    const { type, maxLevel } = _tocStorage[idx] ?? { type: 'bullet', maxLevel: 3 };
    const filtered = headings.filter((h) => h.level <= maxLevel);
    if (!filtered.length) return '';
    const tag = type === 'number' ? 'ol' : 'ul';
    const minLevel = Math.min(...filtered.map((h) => h.level));
    const bullets = ['•', '◦', '▪', '▸', '–', '·'];
    const counters: Record<number, number> = {};
    const items = filtered
      .map((h) => {
        const indent = (h.level - minLevel) * 16;
        let marker: string;
        if (type === 'number') {
          counters[h.level] = (counters[h.level] || 0) + 1;
          for (let l = h.level + 1; l <= 6; l++) counters[l] = 0;
          let label = '';
          for (let l = minLevel; l <= h.level; l++) label += (counters[l] || 0) + '.';
          marker = label;
        } else {
          marker = bullets[(h.level - minLevel) % bullets.length];
        }
        return `<li style="padding-left:${indent}px"><span class="toc-marker">${marker}</span><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`;
      })
      .join('');
    const contentId = `toc-content-${idx}`;
    return `<nav class="toc-block" aria-label="Table of contents"><div class="toc-head"><div class="toc-title">Table of Contents</div><button type="button" class="toc-toggle-btn" data-toc-target="${contentId}" aria-expanded="true" aria-label="Collapse table of contents"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="toc-content" id="${contentId}"><${tag} class="toc-list">${items}</${tag}></div></nav>`;
  });
}

// ── Panel ──────────────────────────────────────────────

const PANEL_ICONS: Record<string, string> = {
  info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  note: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/><path d="M4 5h8M4 8.5h8M4 12h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
let _panelStorage: Array<{ type: string; content: string }> = [];

function preprocessPanels(md: string): string {
  return md.replace(/<panel\s+type=["']?(info|note|warning|error|success)["']?\s*>([\s\S]*?)<\/panel>/gi, (_m, type, inner) => {
    _panelStorage.push({ type: type.toLowerCase(), content: inner.trim() });
    return `[[RAKSARA_PANEL:${_panelStorage.length - 1}]]`;
  });
}

function injectPanels(html: string, markedParse: (s: string) => string): string {
  if (_panelStorage.length === 0) return html;
  return html.replace(/\[\[RAKSARA_PANEL:(\d+)\]\]/g, (_m, idxStr) => {
    const { type, content } = _panelStorage[parseInt(idxStr)] ?? { type: 'info', content: '' };
    const body = markedParse(restoreCode(content));
    const icon = PANEL_ICONS[type] ?? PANEL_ICONS.info;
    return `<div class="panel panel-${type}" role="note"><span class="panel-icon">${icon}</span><div class="panel-body">${body}</div></div>`;
  });
}

// ── Container ─────────────────────────────────────────

let _containerStorage: string[] = [];

function preprocessContainers(md: string): string {
  return md.replace(/<container\s*>([\s\S]*?)<\/container>/gi, (_m, inner) => {
    _containerStorage.push(inner.trim());
    return `[[RAKSARA_CONTAINER:${_containerStorage.length - 1}]]`;
  });
}

function injectContainers(html: string, markedParse: (s: string) => string): string {
  if (_containerStorage.length === 0) return html;
  return html.replace(/\[\[RAKSARA_CONTAINER:(\d+)\]\]/g, (_m, idxStr) => {
    const content = markedParse(restoreCode(_containerStorage[parseInt(idxStr)] ?? ''));
    return `<div class="custom-container glass">${content}</div>`;
  });
}

// ── Chip ──────────────────────────────────────────────

const CHIP_ICONS: Record<string, string> = {
  check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  warning: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  tag: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2h6a1 1 0 011 1v5a1 1 0 01-1 1H8l-6 6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="11" cy="5" r="1" fill="currentColor"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 9a3 3 0 103-3M10 7a3 3 0 11-1.5 2.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 3L1 8l3.5 5M11.5 3l3.5 5-3.5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

let _chipStorage: Array<{ icon: string | null; label: string | null; content: string }> = [];

function preprocessChips(md: string): string {
  return md.replace(/<chip((?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/chip>/gi, (_m, attrsStr, inner) => {
    const iconM = attrsStr.match(/icon=(?:"([^"]*)"|'([^']*)'|(\S+))/);
    const labelM = attrsStr.match(/label=(?:"([^"]*)"|'([^']*)'|(\S+))/);
    const icon = iconM ? (iconM[1] ?? iconM[2] ?? iconM[3] ?? null) : null;
    const label = labelM ? (labelM[1] ?? labelM[2] ?? labelM[3] ?? null) : null;
    _chipStorage.push({ icon, label, content: inner.trim() });
    return `[[RAKSARA_CHIP:${_chipStorage.length - 1}]]`;
  });
}

function injectChips(html: string): string {
  if (_chipStorage.length === 0) return html;
  return html.replace(/\[\[RAKSARA_CHIP:(\d+)\]\]/g, (_m, idxStr) => {
    const { icon, label, content } = _chipStorage[parseInt(idxStr)] ?? { icon: null, label: null, content: '' };
    const iconHtml = icon ? (CHIP_ICONS[icon] ? `<span class="chip-icon">${CHIP_ICONS[icon]}</span>` : `<span class="chip-icon-text">${escapeHtml(icon)}</span>`) : '';
    const labelHtml = label ? `<span class="chip-label">${escapeHtml(label)}</span>` : '';
    return `<span class="chip glass">${iconHtml}${labelHtml}<span class="chip-text">${escapeHtml(content)}</span></span>`;
  });
}

// ── Grid ──────────────────────────────────────────────

let _gridStorage: Array<{ cols: number; gap: string; content: string }> = [];

function preprocessGrid(md: string): string {
  return md.replace(/<grid(?:\s+cols=["']?(\d+)["']?)?(?:\s+gap=["']?([^"'\s>]*)["']?)?\s*>([\s\S]*?)<\/grid>/gi, (_m, cols, gap, inner) => {
    _gridStorage.push({ cols: parseInt(cols ?? '2'), gap: gap ?? '1rem', content: inner.trim() });
    return `[[RAKSARA_GRID:${_gridStorage.length - 1}]]`;
  });
}

function injectGrid(html: string, markedParse: (s: string) => string): string {
  if (_gridStorage.length === 0) return html;
  return html.replace(/(?:<p>)?\[\[RAKSARA_GRID:(\d+)\]\](?:<\/p>)?/g, (_m, idxStr) => {
    const { cols, gap, content } = _gridStorage[parseInt(idxStr)] ?? { cols: 2, gap: '1rem', content: '' };
    const body = markedParse(restoreCode(content));
    return `<div class="rk-grid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${escapeHtml(gap)}">${body}</div>`;
  });
}

// ── Progress ──────────────────────────────────────────

let _progressStorage: Array<{ attrs: Record<string, string>; bars: Array<{ at: number; icon: string; text: string }> }> = [];

const PROGRESS_ICONS: Record<string, string> = {
  fire: '🔥', star: '⭐', check: '✓', flag: '🚩', bolt: '⚡',
  heart: '❤️', trophy: '🏆', target: '🎯', pin: '📌', lock: '🔒',
  rocket: '🚀', gem: '💎', crown: '👑', shield: '🛡️', warning: '⚠️',
};

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const matches = str.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
  for (const m of matches) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? 'true';
  }
  return attrs;
}

function preprocessProgress(md: string): string {
  const toToken = (attrsStr: string, inner = '') => {
    const attrs = parseAttrs(attrsStr);
    const bars: Array<{ at: number; icon: string; text: string }> = [];
    const barRe = /<bar((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/bar>/gi;
    let match: RegExpExecArray | null;
    while ((match = barRe.exec(inner)) !== null) {
      const barAttrs = parseAttrs(match[1]);
      bars.push({ at: parseInt(barAttrs['at'] ?? '0', 10) || 0, icon: barAttrs['icon'] ?? '', text: match[2].trim() });
    }
    _progressStorage.push({ attrs, bars });
    return `\n\n[[RAKSARA_PROGRESS:${_progressStorage.length - 1}]]\n\n`;
  };
  let out = md.replace(/<rk-progress((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/rk-progress>/gi, (_m, attrsStr, inner) => toToken(attrsStr, inner));
  out = out.replace(/<rk-progress((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*\/\s*>/gi, (_m, attrsStr) => toToken(attrsStr));
  out = out.replace(/<progress\s+([^>]*)\/?>/gi, (_m, attrsStr) => {
    const attrs = parseAttrs(attrsStr);
    const value = attrs['value'] ?? attrs['current'] ?? '0';
    return toToken(`current="${value}" total="100" color="${attrs['color'] ?? ''}"`);
  });
  return out;
}

function progressColor(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', purple: 'var(--accent)', green: '#22c55e',
    blue: '#3b82f6', white: '#ffffff', yellow: '#eab308', orange: '#f97316',
  };
  return map[name.toLowerCase()] || escapeHtml(name || 'var(--accent)');
}

function injectProgress(html: string): string {
  if (_progressStorage.length === 0) return html;
  return html.replace(/(?:<p>)?\[\[RAKSARA_PROGRESS:(\d+)\]\](?:<\/p>)?/g, (_m, idxStr) => {
    const { attrs, bars } = _progressStorage[parseInt(idxStr)] ?? { attrs: {}, bars: [] };
    const total = Math.max(1, parseInt(attrs['total'] ?? '100', 10) || 100);
    const current = Math.min(total, Math.max(0, parseInt(attrs['current'] ?? attrs['value'] ?? '0', 10) || 0));
    const pct = (current / total) * 100;
    const color = attrs['color'] ? progressColor(attrs['color']) : 'var(--accent)';
    const borderStyle = attrs['border'] ? ` border-color:${escapeHtml(attrs['border'])};` : '';
    const barsHtml = bars.map((bar) => {
      const barPct = Math.min(100, Math.max(0, (bar.at / total) * 100));
      const iconChar = PROGRESS_ICONS[bar.icon] || (bar.icon ? escapeHtml(bar.icon) : '');
      const marker = iconChar ? `<span class="rk-bar-icon">${iconChar}</span>` : `<span class="rk-bar-dot" style="background:${color}"></span>`;
      const tooltip = bar.text ? `<div class="rk-bar-tooltip">${escapeHtml(bar.text)}</div>` : '';
      return `<div class="rk-bar" style="left:${barPct.toFixed(2)}%">${marker}${tooltip}</div>`;
    }).join('');
    return `<div class="rk-progress-wrap"><div class="rk-progress" style="${borderStyle}" data-pct="${pct.toFixed(2)}"><div class="rk-progress-track"><div class="rk-progress-fill" style="--rk-prog-color:${color}; --rk-prog-target:${pct.toFixed(2)}%" role="progressbar" aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${total}"></div>${barsHtml}</div></div><div class="rk-progress-label"><span class="rk-progress-current">${current}</span><span class="rk-progress-sep">/</span><span class="rk-progress-total">${total}</span></div></div>`;
  });
}

// ── Chart.js code blocks ───────────────────────────────

let _chartStorage: string[] = [];

function collectChartBlock(configText: string): string {
  _chartStorage.push(configText);
  return `<div class="rk-chart-container" data-chart-idx="${_chartStorage.length - 1}" data-chart-config="${escapeHtml(configText)}"></div>`;
}

// ── Mermaid code blocks ────────────────────────────────

let _mermaidBlocks: string[] = [];

function collectMermaidBlock(source: string): string {
  _mermaidBlocks.push(source);
  return `<div class="rk-mermaid" data-mermaid-idx="${_mermaidBlocks.length - 1}">${escapeHtml(source)}</div>`;
}

// ── Main renderMarkdown ───────────────────────────────

export interface RenderOptions {
  /** Respect newlines as BR (poem mode) */
  breaks?: boolean;
  /** Base path for content assets */
  imageManifest?: ImageManifest;
  /** posts/portfolio/dirs for ::chapters context */
  context?: {
    posts?: Array<{ slug: string; title: string; date: string; dir?: string; chapter?: string | number; type?: string; cover?: string; summary?: string }>;
    blogDirs?: Record<string, { subdirs: string[]; posts: string[] }>;
  };
  components?: Array<{ title?: string; slug?: string; path?: string; summary?: string; description?: string; icon?: string; status?: string }>;
}

/**
 * Render markdown to HTML using the full Raksara pipeline.
 * Must be called in the browser (uses dynamic import of marked).
 */
export async function renderMarkdown(md: string, opts: RenderOptions = {}): Promise<string> {
  // Reset per-render storages
  _tocStorage = [];
  _panelStorage = [];
  _containerStorage = [];
  _chipStorage = [];
  _gridStorage = [];
  _progressStorage = [];
  _componentStorage = [];
  _chaptersStorage = [];
  _chartStorage = [];
  _mermaidBlocks = [];

  const { marked, Renderer } = await import('marked');

  const renderer = new Renderer();

  // Images: use responsive srcset when manifest available
  renderer.image = function (token) {
    const href = typeof token === 'object' ? token.href : token;
    const alt = typeof token === 'object' ? token.text ?? '' : '';
    const title = typeof token === 'object' ? token.title ?? '' : '';
    const path = assetUrl(String(href ?? ''));
    if (opts.imageManifest) {
      const attrs = responsiveAttrsToString(buildResponsiveAttrs(path, opts.imageManifest));
      return `<img ${attrs} alt="${escapeHtml(alt)}" title="${escapeHtml(title)}">`; 
    }
    return `<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}" loading="lazy" decoding="async">`;
  };

  // Headings: slugified IDs for anchor links
  renderer.heading = function (token) {
    const text = typeof token === 'object' ? token.text ?? '' : String(token);
    const depth = typeof token === 'object' ? token.depth ?? 1 : 1;
    const id = slugifyHeading(text);
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  // Links: resolve content-relative paths + open external in new tab
  renderer.link = function (token) {
    const href = (typeof token === 'object' ? token.href : String(token)) ?? '';
    const title = typeof token === 'object' ? token.title ?? '' : '';
    const text = typeof token === 'object' ? token.text ?? '' : '';
    const resolved = resolveContentLink(href);
    const external = resolved.startsWith('http://') || resolved.startsWith('https://');
    return `<a href="${resolved}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text || resolved}</a>`;
  };

  // Code blocks: chart.js / mermaid / hljs-ready markup
  renderer.code = function (token) {
    const rawCode = typeof token === 'object' ? token.text ?? '' : String(token ?? '');
    const rawLang = typeof token === 'object' ? token.lang ?? '' : '';
    const lang = String(rawLang).trim().split(/\s+/)[0].toLowerCase();

    if (lang === 'chart') return collectChartBlock(rawCode.trim());
    if (lang === 'mermaid') return collectMermaidBlock(rawCode.trim());

    const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return `<pre><code${classAttr}>${escapeHtml(rawCode)}</code></pre>\n`;
  };

  marked.use({ renderer, breaks: opts.breaks ?? false, gfm: true });

  // Helper: nested marked.parse for panels/containers/grid
  const markedParse = (s: string) => marked.parse(s) as string;

  // 1. Vault code blocks
  const vaulted = vaultCode(md);

  // 2. Preprocessors (order matters — file first, then structural, then inline)
  const preprocessed = restoreCode(
    preprocessGrid(
      preprocessProgress(
        preprocessChips(
          preprocessContainers(
            preprocessPanels(
              preprocessToc(
                preprocessChapters(
                  preprocessComponents(
                    preprocessFileAttachments(vaulted)
                  )
                )
              )
            )
          )
        )
      )
    )
  );

  // 3. marked parse
  const rawHtml = marked.parse(preprocessed) as string;

  // 4. Inject custom elements
  const finalHtml = injectGrid(
    injectProgress(
      injectChips(
        injectContainers(
          injectPanels(
            injectChapters(
              injectComponents(
                injectToc(rawHtml),
                opts.components
              ),
              opts.context
            ),
            markedParse
          ),
          markedParse
        )
      )
    ),
    markedParse
  );

  return finalHtml;
}

// ── Post-render DOM init functions ────────────────────
// Call these in onMount after setting innerHTML.

/** Highlight all <code> blocks with hljs (lazy-loads from CDN). */
export async function initHighlight(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('pre code[class*="language-"]');
  if (!blocks.length) return;
  try {
    let hljs = (window as unknown as Record<string, unknown>)['hljs'] as { highlightElement: (el: Element) => void; getLanguage?: (lang: string) => unknown; registerLanguage?: (lang: string, def: unknown) => void } | undefined;
    if (!hljs) {
      await loadScriptOnce('/vendor-highlight.min.js').catch(() =>
        loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js')
      );
      hljs = (window as unknown as Record<string, unknown>)['hljs'] as { highlightElement: (el: Element) => void; getLanguage?: (lang: string) => unknown; registerLanguage?: (lang: string, def: unknown) => void } | undefined;
    }
    if (!hljs) return;
    await Promise.all(Array.from(blocks).map(async (block) => {
      const langClass = Array.from(block.classList).find((cls) => cls.startsWith('language-'));
      const rawLang = langClass ? langClass.slice('language-'.length).toLowerCase() : '';
      const normalized = normalizeHighlightLanguage(rawLang);
      if (normalized && hljs?.getLanguage && !hljs.getLanguage(normalized)) {
        try {
          const mod = await import(/* @vite-ignore */ `/vendor/hljs/es/languages/${normalized}.js`);
          const def = (mod as { default?: unknown }).default ?? mod;
          if (typeof def === 'function') hljs.registerLanguage?.(normalized, def);
        } catch {
          // Leave unsupported languages unhighlighted below.
        }
      }
    }));
    blocks.forEach((block) => {
      try {
        const langClass = Array.from(block.classList).find((cls) => cls.startsWith('language-'));
        const rawLang = langClass ? langClass.slice('language-'.length).toLowerCase() : '';
        const normalized = normalizeHighlightLanguage(rawLang);
        if (langClass && hljs?.getLanguage && !hljs.getLanguage(normalized)) {
          block.classList.remove(langClass);
          block.classList.add('nohighlight');
          return;
        }
        hljs!.highlightElement(block);
      } catch {
        block.classList.add('nohighlight');
      }
    });
  } catch {
    // hljs unavailable — leave raw code
  }
}

function normalizeHighlightLanguage(raw: string): string {
  const lang = String(raw || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    shell: 'bash',
    sh: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    md: 'markdown',
    html: 'xml',
    xhtml: 'xml',
    svg: 'xml',
    plist: 'xml',
    cucumber: 'gherkin',
    feature: 'gherkin',
    plaintext: 'plaintext',
    text: 'plaintext',
    plain: 'plaintext',
    txt: 'plaintext',
    log: 'plaintext',
  };
  return aliases[lang] || lang;
}

/** Render all rk-chart-container elements with Chart.js (lazy-loads). */
export async function initCharts(container: HTMLElement): Promise<void> {
  const charts = container.querySelectorAll<HTMLElement>('.rk-chart-container');
  if (!charts.length) return;
  try {
    let Chart = (window as unknown as Record<string, unknown>)['Chart'] as (new (...a: unknown[]) => unknown) | undefined;
    if (!Chart) {
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js').catch(
        () => loadScriptOnce('/vendor-chart.min.js')
      );
      Chart = (window as unknown as Record<string, unknown>)['Chart'] as (new (...a: unknown[]) => unknown) | undefined;
    }
    if (!Chart) return;

    const ZOOM_STEP = 0.2;
    const ZOOM_MIN = 0.6;
    const ZOOM_MAX = 3;

    function createChartShell(el: HTMLElement) {
      const controls = document.createElement('div');
      controls.className = 'rk-chart-zoom-controls';

      const zoomOut = document.createElement('button');
      zoomOut.className = 'rk-chart-zoom-btn';
      zoomOut.type = 'button';
      zoomOut.textContent = '−';
      zoomOut.setAttribute('aria-label', 'Zoom out chart');

      const zoomIn = document.createElement('button');
      zoomIn.className = 'rk-chart-zoom-btn';
      zoomIn.type = 'button';
      zoomIn.textContent = '+';
      zoomIn.setAttribute('aria-label', 'Zoom in chart');

      const reset = document.createElement('button');
      reset.className = 'rk-chart-zoom-btn';
      reset.type = 'button';
      reset.textContent = 'Reset';
      reset.setAttribute('aria-label', 'Reset chart zoom');

      const zoomLevel = document.createElement('span');
      zoomLevel.className = 'rk-chart-zoom-level';
      zoomLevel.textContent = '100%';

      controls.append(zoomOut, zoomIn, reset, zoomLevel);

      const viewport = document.createElement('div');
      viewport.className = 'rk-chart-viewport';

      const inner = document.createElement('div');
      inner.className = 'rk-chart-inner';

      const canvas = document.createElement('canvas');
      inner.appendChild(canvas);
      viewport.appendChild(inner);

      el.innerHTML = '';
      el.append(controls, viewport);

      let chartInstance: { resize?: (width?: number, height?: number) => void; width?: number; height?: number } | null = null;
      let baseWidth = 900;
      let baseHeight = 520;
      let baseChartWidth = 900;
      let baseChartHeight = 520;
      const CHART_PADDING = 60;

      let zoom = 1;
      const setZoom = (next: number, keepCenter = true) => {
        const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(next.toFixed(2))));
        if (clamped === zoom) return;

        const oldZoom = zoom;
        zoom = clamped;

        const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
        const centerY = viewport.scrollTop + viewport.clientHeight / 2;

        const targetChartWidth = Math.max(360, Math.round(baseChartWidth * zoom));
        const targetChartHeight = Math.max(280, Math.round(baseChartHeight * zoom));
        const targetInnerWidth = Math.max(baseWidth, targetChartWidth + CHART_PADDING);
        const targetInnerHeight = Math.max(baseHeight, targetChartHeight + CHART_PADDING);

        inner.style.width = `${targetInnerWidth}px`;
        inner.style.height = `${targetInnerHeight}px`;

        // Force Chart.js to resize the actual drawing surface, not only its container.
        chartInstance?.resize?.(targetChartWidth, targetChartHeight);

        if (keepCenter) {
          requestAnimationFrame(() => {
            const ratio = zoom / oldZoom;
            viewport.scrollLeft = Math.max(0, centerX * ratio - viewport.clientWidth / 2);
            viewport.scrollTop = Math.max(0, centerY * ratio - viewport.clientHeight / 2);
          });
        }

        zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
        zoomOut.disabled = zoom <= ZOOM_MIN;
        zoomIn.disabled = zoom >= ZOOM_MAX;
      };

      zoomOut.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
      zoomIn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
      reset.addEventListener('click', () => {
        setZoom(1);
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      });

      const initBaseSize = () => {
        baseWidth = Math.max(720, viewport.clientWidth - 40);
        baseHeight = Math.max(420, Math.round(baseWidth * 0.58));
        inner.style.width = `${baseWidth}px`;
        inner.style.height = `${baseHeight}px`;
      };

      const fitChartToViewport = () => {
        const viewportW = Math.max(360, viewport.clientWidth);
        const viewportH = Math.max(280, viewport.clientHeight);
        const sourceW = Math.max(1, chartInstance?.width ?? viewportW);
        const sourceH = Math.max(1, chartInstance?.height ?? viewportH);
        const ratio = sourceW / sourceH;

        const maxW = Math.max(320, viewportW - CHART_PADDING);
        const maxH = Math.max(240, viewportH - CHART_PADDING);

        let fittedW = maxW;
        let fittedH = fittedW / ratio;
        if (fittedH > maxH) {
          fittedH = maxH;
          fittedW = fittedH * ratio;
        }

        baseChartWidth = Math.max(320, Math.round(fittedW));
        baseChartHeight = Math.max(240, Math.round(fittedH));
        baseWidth = Math.max(viewportW, baseChartWidth + CHART_PADDING);
        baseHeight = Math.max(viewportH, baseChartHeight + CHART_PADDING);

        inner.style.width = `${baseWidth}px`;
        inner.style.height = `${baseHeight}px`;
        chartInstance?.resize?.(baseChartWidth, baseChartHeight);
        viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
        viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
      };

      initBaseSize();
      zoomOut.disabled = true;

      return {
        canvas,
        bindChart(instance: { resize?: () => void } | null) {
          chartInstance = instance as { resize?: (width?: number, height?: number) => void; width?: number; height?: number } | null;
          initBaseSize();
          fitChartToViewport();
        },
      };
    }

    charts.forEach((el) => {
      const config = decodeURIComponent(el.dataset['chartConfig'] ?? '{}');
      try {
        // Content-authored chart blocks follow legacy Raksara and Chart.js examples:
        // object literals with unquoted keys are supported, not only strict JSON.
        // eslint-disable-next-line no-new-func
        const parsed = new Function('"use strict"; return (' + config + ');')();
        const shell = createChartShell(el);
        const chartConfig = parsed as Record<string, unknown>;

        const options = (chartConfig.options && typeof chartConfig.options === 'object'
          ? chartConfig.options
          : {}) as Record<string, unknown>;
        options['responsive'] = true;
        if (options['maintainAspectRatio'] == null) {
          options['maintainAspectRatio'] = false;
        }
        chartConfig.options = options;

        if (parsed?.data && typeof parsed.data === 'string') {
          fetch(assetUrl(parsed.data))
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
              parsed.data = data;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chart = new (Chart as any)(shell.canvas, parsed);
              shell.bindChart(chart as { resize?: () => void });
            })
            .catch(() => {
              el.style.display = 'none';
            });
          return;
        }
        if (!parsed?.type || !parsed?.data) {
          el.style.display = 'none';
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart = new (Chart as any)(shell.canvas, parsed);
        shell.bindChart(chart as { resize?: () => void });
      } catch {
        el.style.display = 'none';
      }
    });
  } catch {
    // Chart.js unavailable
  }
}

/** Render all rk-mermaid elements with Mermaid (lazy-loads from CDN). */
export async function initMermaid(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('.rk-mermaid');
  if (!blocks.length) return;
  try {
    // @ts-expect-error mermaid global
    let mermaid = window['mermaid'] as { initialize: (cfg: object) => void; run: (opts: object) => void } | undefined;
    if (!mermaid) {
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js');
      // @ts-expect-error mermaid global
      mermaid = window['mermaid'] as typeof mermaid;
    }
    if (!mermaid) return;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
    blocks.forEach((el, i) => {
      el.setAttribute('id', `mermaid-${i}`);
    });
    mermaid.run({ nodes: Array.from(blocks) });
  } catch {
    // mermaid unavailable
  }
}

/** Make all <table> headers in .article-body sortable. */
export function initSortableTables(container: HTMLElement): void {
  container.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const thead = table.querySelector('thead');
    if (!thead) return;
    const headers = thead.querySelectorAll<HTMLTableCellElement>('th');
    headers.forEach((th, colIndex) => {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.setAttribute('role', 'button');
      th.setAttribute('aria-sort', 'none');
      
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const cur = th.getAttribute('aria-sort') ?? 'none';
        let asc: boolean | null = cur === 'none' || cur === 'desc' ? true : cur === 'ascending' ? false : null;
        headers.forEach((h) => h.setAttribute('aria-sort', 'none'));
        if (asc === null) return;
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        rows.sort((a, b) => {
          const ca = a.querySelectorAll('td')[colIndex]?.textContent?.trim() ?? '';
          const cb = b.querySelectorAll('td')[colIndex]?.textContent?.trim() ?? '';
          const na = parseFloat(ca), nb = parseFloat(cb);
          const numeric = !isNaN(na) && !isNaN(nb) && ca !== '' && cb !== '';
          return numeric ? (asc ? na - nb : nb - na) : (asc ? ca.localeCompare(cb) : cb.localeCompare(ca));
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  });
}

/** Hydrate ::toc() toggle buttons (collapse/expand). */
export function initTocBlocks(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.toc-toggle-btn').forEach((btn) => {
    if (btn.dataset['bound'] === '1') return;
    btn.dataset['bound'] = '1';
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toc-target');
      if (!targetId) return;
      const content = document.getElementById(targetId);
      if (!content) return;
      const expanded = btn.getAttribute('aria-expanded') !== 'false';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      content.hidden = expanded;
    });
  });
}

/** Resolve file attachment sizes via HEAD requests. */
export async function initFileAttachmentSizes(container: HTMLElement): Promise<void> {
  const els = container.querySelectorAll<HTMLElement>('.file-attachment-size[data-size-url]');
  await Promise.all(
    Array.from(els).map(async (el) => {
      const url = el.dataset['sizeUrl'] ?? '';
      el.removeAttribute('data-size-url');
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          const cl = res.headers.get('content-length');
          el.textContent = cl ? formatFileSize(parseInt(cl, 10)) : '';
        }
      } catch {
        // size unavailable
      }
    })
  );
}

/**
 * Run all post-render initialisers in order.
 * Call this once after setting innerHTML with the rendered markdown.
 */
export async function initArticleFeatures(container: HTMLElement): Promise<void> {
  initArticleImages(container);
  initProgressBars(container);
  initVideoPlayers(container);
  initCodeBlocks(container);
  initSortableTables(container);
  initTocBlocks(container);
  initComponentLists(container);
  initChaptersTables(container);
  await Promise.all([
    initHighlight(container),
    initCharts(container),
    initMermaid(container),
    initFileAttachmentSizes(container),
  ]);
}

function initProgressBars(container: HTMLElement): void {
  const fills = container.querySelectorAll<HTMLElement>('.rk-progress-fill:not([data-animated])');
  if (!fills.length) return;
  const animate = (fill: HTMLElement) => {
    fill.dataset['animated'] = '1';
    requestAnimationFrame(() => fill.classList.add('rk-progress-animating'));
  };
  if (!('IntersectionObserver' in window)) {
    fills.forEach(animate);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const fill = entry.target as HTMLElement;
      observer.unobserve(fill);
      animate(fill);
    });
  }, { threshold: 0.3 });
  fills.forEach((fill) => {
    observer.observe(fill);
    window.setTimeout(() => {
      if (!fill.dataset['animated']) {
        observer.unobserve(fill);
        animate(fill);
      }
    }, 450);
  });
}

function initArticleImages(container: HTMLElement): void {
  container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const shell = img.closest<HTMLElement>('.is-loading, .post-card-thumb, .gallery-card-img, .gallery-stack-card, .article-cover, .poem-cover, .img-skeleton');
    const lqip = img.dataset['lqip'];
    if (shell && lqip && !shell.classList.contains('lqip-shown')) {
      shell.style.setProperty('--lqip-url', `url("${lqip}")`);
      shell.classList.add('lqip-shown');
    }
    const settle = () => {
      if (shell && !lqip && (img.currentSrc || img.src)) {
        shell.style.setProperty('--lqip-url', `url("${img.currentSrc || img.src}")`);
        shell.classList.add('lqip-shown');
      }
      img.classList.add('loaded');
      shell?.classList.remove('is-loading');
      shell?.classList.add('is-loaded');
    };
    if (img.complete) settle();
    else {
      img.addEventListener('load', settle, { once: true });
      img.addEventListener('error', settle, { once: true });
    }
  });
}

let codeToastTimer: number | undefined;

function showCodeToast(message: string): void {
  let toast = document.querySelector<HTMLElement>('.code-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'code-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (codeToastTimer) window.clearTimeout(codeToastTimer);
  codeToastTimer = window.setTimeout(() => toast?.classList.remove('show'), 1800);
}

function initCodeBlocks(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block-wrap')) return;
    const code = pre.querySelector('code');
    if (!code) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const codeText = code.textContent ?? '';
    const lines = codeText.split(/\r?\n/).length;
    if (lines > 18 || codeText.length > 1100) {
      wrap.classList.add('is-collapsed');
      const fade = document.createElement('div');
      fade.className = 'code-fade';
      wrap.appendChild(fade);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'code-toggle-btn';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Expand';
      toggle.title = 'Expand code';
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        wrap.classList.toggle('is-collapsed', expanded);
        toggle.textContent = expanded ? 'Expand' : 'Collapse';
        toggle.title = expanded ? 'Expand code' : 'Collapse code';
      });
      wrap.appendChild(toggle);
    }
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'code-copy-btn';
    copy.title = 'Copy code';
    const copyIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
    const copiedIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    copy.innerHTML = copyIcon;
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(codeText).catch(() => {});
      copy.classList.add('copied');
      copy.innerHTML = copiedIcon;
      showCodeToast('Code copied');
      setTimeout(() => {
        copy.classList.remove('copied');
        copy.innerHTML = copyIcon;
      }, 2000);
    });
    wrap.appendChild(copy);
  });
}

function initVideoPlayers(container: HTMLElement): void {
  container.querySelectorAll<HTMLAnchorElement>('.article-body a.video-player').forEach((anchor) => {
    if (anchor.dataset['videoInit'] === '1') return;
    anchor.dataset['videoInit'] = '1';
    const href = anchor.getAttribute('href') ?? '';
    const img = anchor.querySelector<HTMLImageElement>('img');
    const title = img?.alt || anchor.dataset['title'] || '';
    const thumbSrc = img?.getAttribute('src') || anchor.dataset['thumbnail'] || '';
    if (!href || !thumbSrc) return;
    const player = document.createElement('button');
    player.type = 'button';
    player.className = 'video-player';
    player.setAttribute('aria-label', title ? `Open video: ${title}` : 'Open video');
    player.innerHTML = `
      <img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
      <div class="video-player-overlay">
        <div class="video-player-play">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
        ${title ? `<div class="video-player-title">${escapeHtml(title)}</div>` : ''}
      </div>`;
    player.addEventListener('click', () => window.open(href, '_blank', 'noopener,noreferrer'));
    anchor.replaceWith(player);
  });
}

function initChaptersTables(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.chapters-block').forEach((block) => {
    if (block.dataset['init']) return;
    block.dataset['init'] = '1';
    const tbody = block.querySelector('tbody');
    if (!tbody) return;

    const getTopRows = () => Array.from(tbody.querySelectorAll<HTMLTableRowElement>('.chapters-row:not(.chapters-row-child)'));
    const hideChildren = () => tbody.querySelectorAll<HTMLTableRowElement>('.chapters-row-child').forEach((row) => { row.hidden = true; });

    block.querySelectorAll<HTMLTableCellElement>('.chapters-th-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset['col'];
        const next = th.dataset['order'] === 'asc' ? 'desc' : 'asc';
        block.querySelectorAll<HTMLElement>('.chapters-th-sortable').forEach((header) => { header.dataset['order'] = ''; });
        th.dataset['order'] = next;
        const rows = getTopRows();
        rows.forEach((row) => { row.hidden = false; row.dataset['expanded'] = 'false'; });
        hideChildren();
        rows.sort((a, b) => {
          if (col === 'date') {
            const ta = new Date(a.dataset['date'] ?? '').getTime() || 0;
            const tb = new Date(b.dataset['date'] ?? '').getTime() || 0;
            return next === 'asc' ? ta - tb : tb - ta;
          }
          const va = (a.dataset['title'] ?? '').toLowerCase();
          const vb = (b.dataset['title'] ?? '').toLowerCase();
          return next === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
        for (const row of rows) {
          tbody.appendChild(row);
          if (row.classList.contains('chapters-row-dir')) {
            const id = row.dataset['dirId'];
            tbody.querySelectorAll<HTMLTableRowElement>(`.chapters-row-child[data-parent-dir="${CSS.escape(id ?? '')}"]`).forEach((child) => tbody.appendChild(child));
          }
        }
      });
    });

    block.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const dirRow = target.closest<HTMLTableRowElement>('.chapters-row-dir');
      if (dirRow) {
        const id = dirRow.dataset['dirId'];
        const expanded = dirRow.dataset['expanded'] === 'true';
        dirRow.dataset['expanded'] = expanded ? 'false' : 'true';
        block.querySelectorAll<HTMLTableRowElement>(`.chapters-row-child[data-parent-dir="${CSS.escape(id ?? '')}"]`).forEach((row) => {
          row.hidden = expanded;
        });
        return;
      }
      const postRow = target.closest<HTMLTableRowElement>('.chapters-row-page, .chapters-row-child[data-slug]');
      const slug = postRow?.dataset['slug'];
      if (slug) window.location.href = `/blog/post/${slug}`;
    });
  });
}

function initComponentLists(container: HTMLElement): void {
  container.querySelectorAll<HTMLInputElement>('.component-list-search').forEach((input) => {
    if (input.dataset['init']) return;
    input.dataset['init'] = '1';
    const listId = input.dataset['list'];
    const list = listId ? container.querySelector<HTMLElement>(`#${CSS.escape(listId)}`) : null;
    if (!list) return;
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      const cards = Array.from(list.querySelectorAll<HTMLElement>('.component-card'));
      let visible = 0;
      for (const card of cards) {
        const haystack = `${card.dataset['title'] ?? ''} ${card.dataset['desc'] ?? ''}`;
        const show = !query || haystack.includes(query);
        card.hidden = !show;
        if (show) visible += 1;
      }
      let empty = list.querySelector<HTMLElement>('.component-list-empty');
      if (!visible) {
        if (!empty) {
          empty = document.createElement('p');
          empty.className = 'component-list-empty';
          empty.textContent = 'No components match your search.';
          list.appendChild(empty);
        }
      } else {
        empty?.remove();
      }
    });
  });
}

// ── Script loader helper ──────────────────────────────

const _loadedScripts = new Set<string>();
const _pendingScripts = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  if (_loadedScripts.has(src)) return Promise.resolve();
  if (_pendingScripts.has(src)) return _pendingScripts.get(src)!;
  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = () => { _loadedScripts.add(src); resolve(); };
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
  _pendingScripts.set(src, p);
  return p;
}
