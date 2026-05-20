/** Format an ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm...) to a human-readable label. */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Convert a slug / kebab-case string to a human-readable title. */
export function humanize(slug: string): string {
  return slug
    .replace(/-{2,}/g, ' \u2013 ')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// __BUILD_TS__ is injected by Vite at build time.
declare const __BUILD_TS__: string;
const _assetV = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';

/** Normalize content asset references for SvelteKit static serving. */
export function assetUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  let path = String(raw).trim();
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  path = path.replace(/^\/+/, '');
  // Strip existing query params/hash before re-versioning to prevent double-?v=
  // when this function is called on an already-versioned URL (e.g. share.ts pipeline).
  path = path.replace(/[?#].*$/, '');
  path = path.replace(/^content\/content\//, 'content/');
  if (!path.startsWith('content/') && /^(assets|blog|gallery|pages|portfolio|thoughts)\//.test(path)) {
    path = `content/${path}`;
  }
  const normalized = `/${path}`;
  return _assetV ? `${normalized}?v=${_assetV}` : normalized;
}

/**
 * Remove top-of-file YAML frontmatter safely.
 * Closing delimiter must be on its own line so values containing `---` stay intact.
 */
export function stripYamlFrontmatter(markdown: string | null | undefined): string | null {
  if (typeof markdown !== 'string') return null;
  const input = markdown.replace(/^\uFEFF/, '');
  if (!input.startsWith('---')) return input;
  return input.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n)?/, '');
}

export async function shareUrl(title: string, url: string, text?: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(`${title} : ${url}`);
    }
    return true;
  } catch {
    return false;
  }
}
