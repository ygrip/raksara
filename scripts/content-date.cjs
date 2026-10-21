/**
 * Frontmatter YAML parsers return unquoted dates as Date objects; rendered
 * content metadata uses YYYY-MM-DD strings consistently for comparison,
 * search, sitemap timestamps and client consumption.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
function normalizeContentDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : undefined;
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw)) {
      const date = new Date(raw);
      return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
    }
  }
  return undefined;
}

module.exports = { normalizeContentDate };
