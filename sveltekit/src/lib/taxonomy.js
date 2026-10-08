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
