/**
 * AdSense helpers shared by the site shell and the lightweight Node tests.
 * ads.txt uses pub-..., while the verification meta tag and script need ca-pub-....
 */

/** @param {unknown} value */
export function toAdsenseClientId(value) {
  const candidate = String(value ?? '').trim();
  const match = /^(?:ca-)?(pub-\d{6,})$/i.exec(candidate);
  if (!match || /^pub-0+$/.test(match[1].toLowerCase())) return '';
  return `ca-${match[1].toLowerCase()}`;
}

/**
 * Only substantial, prerendered article/project detail pages are eligible to
 * load an ad provider. This intentionally excludes homepage, discovery shells,
 * policies, search, 404s, poems, novels, comics and other lightweight views.
 * Eligibility does NOT certify the content as policy-compliant.
 *
 * @param {string} pathname
 * @param {{ post?: { slug?: string, type?: string }, item?: { slug?: string }, renderedHtml?: string } | null | undefined} data
 */
export function isAdEligibleContentPage(pathname, data) {
  const path = '/' + String(pathname ?? '').replace(/^\/+|\/+$/g, '');
  if (!data || typeof data.renderedHtml !== 'string' || !data.renderedHtml.trim()) return false;
  if (/^\/blog\/post\/.+/.test(path) && data.post?.slug) {
    if (!path.endsWith('/' + data.post.slug)) return false;
    return !['poem', 'novel', 'chapters', 'comic'].includes(data.post.type ?? 'blog');
  }
  if (/^\/portfolio\/[^/]+$/.test(path) && data.item?.slug) {
    return path === '/portfolio/' + data.item.slug;
  }
  return false;
}
