/**
 * Invalid or omitted content configuration falls back to 30 terms per page.
 * @param {unknown} value
 * @returns {number}
 */
export function resolveTaxonomyPageSize(value) {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
		? value
		: 30;
}

/** @param {string} pathname */
export function normalizeTaxonomyPath(pathname) {
	return `/${pathname.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

/** @param {string} pathname */
export function isTaxonomyPath(pathname) {
	const path = normalizeTaxonomyPath(pathname);
	return path === '/tag' || path === '/category' || path.startsWith('/tag/') || path.startsWith('/category/');
}

/**
 * Presentation in config.topics never implicitly opts a term into indexing.
 * @param {string} term
 * @param {{ taxonomy?: { highlighted_tags?: string[]; highlighted_categories?: string[] } } | null | undefined} config
 */
export function isHighlightedTag(term, config) {
	return config?.taxonomy?.highlighted_tags?.includes(term) ?? false;
}

/** Curated categories require a separate, explicit opt-in from highlighted tags. */
export function isHighlightedCategory(term, config) {
	return config?.taxonomy?.highlighted_categories?.includes(term) ?? false;
}

/**
 * @param {string} pathname
 * @param {{ taxonomy?: { highlighted_tags?: string[]; highlighted_categories?: string[] } } | null | undefined} config
 */
export function isIndexableTaxonomyPath(pathname, config) {
	const path = normalizeTaxonomyPath(pathname);
	const match = path.match(/^\/(tag|category)\/([^/]+)$/);
	if (!match) return false;
	try {
		const term = decodeURIComponent(match[2]);
		return match[1] === 'tag' ? isHighlightedTag(term, config) : isHighlightedCategory(term, config);
	} catch {
		return false;
	}
}

/**
 * @param {'tag' | 'category'} kind
 * @param {string} term
 * @param {{ taxonomy?: { highlighted_tags?: string[]; highlighted_categories?: string[] } } | null | undefined} config
 */
export function taxonomyHref(kind, term, config) {
	if (kind === 'tag' && isHighlightedTag(term, config)) return `/tag/${encodeURIComponent(term)}/`;
	if (kind === 'category' && isHighlightedCategory(term, config)) return `/category/${encodeURIComponent(term)}/`;
	return `/${kind}/?${new URLSearchParams({ name: term })}`;
}

/**
 * Rewrite authored legacy internal links, preserving view parameters and fragments.
 * @param {string} href
 * @param {{ taxonomy?: { highlighted_tags?: string[]; highlighted_categories?: string[] } } | null | undefined} config
 */
export function rewriteTaxonomyHref(href, config) {
	if (!href.startsWith('/tag/') && !href.startsWith('/category/')) return href;
	try {
		const source = new URL(href, 'https://raksara.invalid');
		const match = source.pathname.match(/^\/(tag|category)\/([^/]+)\/?$/);
		if (!match) return href;
		const kind = /** @type {'tag' | 'category'} */ (match[1]);
		const target = new URL(taxonomyHref(kind, decodeURIComponent(match[2]), config), source.origin);
		for (const [key, value] of source.searchParams) {
			if (key !== 'name') target.searchParams.append(key, value);
		}
		target.hash = source.hash;
		return target.pathname + target.search + target.hash;
	} catch {
		return href;
	}
}
