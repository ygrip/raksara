/**
 * Convert authored content asset paths to the paths published under /content/.
 * Keep remote URLs and root-level app assets untouched.
 * Mirrors normalizeImagePath in sveltekit/src/lib/responsive-image.ts.
 */
function resolveContentAssetPath(raw) {
  if (!raw) return '';
  let path = String(raw).trim();
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || /^(data|blob):/i.test(path)) return path;
  path = path.replace(/^\/+/, '').replace(/[?#].*$/, '');
  path = path.replace(/^content\/content\//, 'content/');
  if (!path.startsWith('content/') && /^(assets|blog|gallery|pages|portfolio|thoughts)\//.test(path)) {
    path = `content/${path}`;
  }
  return path;
}

module.exports = { resolveContentAssetPath };
