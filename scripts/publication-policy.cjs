/**
 * Build-time publication policy. This controls whether source Markdown becomes
 * a public page, feed entry, search hit or downloadable file.
 * Workflow status is kept separate from publication visibility.
 */
const fs = require('node:fs');
const path = require('node:path');

const CONTENT_SECTIONS = new Set(['blog', 'portfolio', 'pages', 'gallery', 'thoughts']);

/**
 * @param {unknown} frontmatter
 * @param {unknown} siteConfig
 */
function isPublished(frontmatter, siteConfig = {}) {
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) return false;
  const fm = frontmatter;
  if (fm.published === false || fm.draft === true) return false;
  if (fm.visibility != null && fm.visibility !== 'public') return false;
  const configured = siteConfig?.publication?.hidden_statuses;
  const hiddenStatuses = Array.isArray(configured) ? configured : ['draft'];
  return !hiddenStatuses.includes(String(fm.status ?? '').trim().toLowerCase());
}

/** @param {string} relativeFile */
function isContentMarkdown(relativeFile) {
  const normalized = relativeFile.replace(/\\/g, '/').replace(/^content\//, '');
  const parts = normalized.split('/');
  return CONTENT_SECTIONS.has(parts[0]) && normalized.endsWith('.md');
}

/**
 * The content copy happens after the public metadata index is built. Remove all
 * unpublished markdown from the physical static directory, including nested
 * legacy content/content paths. Never ship unpublished source just because its
 * route was excluded from the sitemap.
 *
 * @param {string} staticContentDir
 * @param {Set<string>} allowedFiles paths relative to the source content root
 */
function prunePrivateMarkdown(staticContentDir, allowedFiles) {
  let pruned = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const relative = path.relative(staticContentDir, absolute).replace(/\\/g, '/');
      if (!isContentMarkdown(relative)) continue;
      if (allowedFiles.has(relative) || (relative.startsWith('content/') && allowedFiles.has(relative.slice('content/'.length)))) continue;
      fs.rmSync(absolute);
      pruned++;
    }
  }
  walk(staticContentDir);
  return pruned;
}

module.exports = { isPublished, isContentMarkdown, prunePrivateMarkdown };
