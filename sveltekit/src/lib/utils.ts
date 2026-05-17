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
  path = path.replace(/^content\/content\//, 'content/');
  if (!path.startsWith('content/') && /^(assets|blog|gallery|pages|portfolio|thoughts)\//.test(path)) {
    path = `content/${path}`;
  }
  return `/${path}`;
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
