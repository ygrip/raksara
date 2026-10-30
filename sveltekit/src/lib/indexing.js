/**
 * Site-configured search-indexing exclusions shared by the browser layout,
 * the metadata builder (sitemap + prerendered robots), and the validators.
 *
 * Content config:
 *   seo:
 *     noindex_paths:
 *       - /blog/post/poem/**
 *
 * Matching paths render `noindex, follow`, are left out of sitemap.xml, and
 * stay readable and linked for visitors. Patterns use the same syntax as
 * advertising paths: "*" matches one segment, "**" matches zero or more.
 */
import { matchesAdPath } from './advertising.js';

/**
 * @param {unknown} config
 * @returns {string[]}
 */
export function resolveNoindexPatterns(config) {
	if (!config || typeof config !== 'object') return [];
	const seo = /** @type {Record<string, unknown>} */ (config).seo;
	if (!seo || typeof seo !== 'object') return [];
	const patterns = /** @type {Record<string, unknown>} */ (seo).noindex_paths;
	if (!Array.isArray(patterns)) return [];
	return patterns.filter((pattern) => typeof pattern === 'string' && pattern.startsWith('/'));
}

/**
 * @param {string} pathname
 * @param {unknown} config
 * @returns {boolean}
 */
export function isConfiguredNoindexPath(pathname, config) {
	const patterns = resolveNoindexPatterns(config);
	return patterns.some((pattern) => matchesAdPath(pathname, pattern));
}
