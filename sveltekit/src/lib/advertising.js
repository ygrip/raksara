/**
 * Optional AdSense configuration shared by the browser and metadata builder.
 * Raksara has no site-specific advertiser IDs or advertising routes.
 */

/** @param {unknown} value */
export function toAdsenseClientId(value) {
  const candidate = String(value ?? '').trim();
  const match = /^(?:ca-)?(pub-\d{6,})$/i.exec(candidate);
  if (!match || /^pub-0+$/.test(match[1].toLowerCase())) return '';
  return `ca-${match[1].toLowerCase()}`;
}

/** @param {unknown} raw */
function extractPublisher(raw) {
  if (typeof raw === 'string') {
    const parts = raw.split(',').map(value => value.trim());
    return parts.length > 1 ? parts[1] : raw;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const data = /** @type {Record<string, unknown>} */ (raw);
  return data.publisher_id ?? data.publisherId ?? data.publisher ?? data.pub ?? data.account ?? '';
}

/**
 * @typedef {{
 *   enabled: boolean;
 *   clientId: string;
 *   publisherId: string;
 *   adsTxtLine: string;
 *   loadStrategy: 'immediate' | 'interaction';
 *   allowedPaths: string[];
 *   excludedPaths: string[];
 *   allowLocalhost: boolean;
 * }} AdsenseSettings
 */

/**
 * Preferred site config: advertising.adsense (enabled must be true).
 * Legacy site config: adsense (the old ads.txt record). It remains supported
 * for account verification, but script injection needs explicit allowed_paths.
 * Nothing is emitted when the feature is absent or explicitly disabled.
 *
 * @param {unknown} siteConfig
 * @returns {AdsenseSettings}
 */
export function resolveAdsenseConfig(siteConfig) {
  const disabled = {
    enabled: false, clientId: '', publisherId: '', adsTxtLine: '',
    loadStrategy: /** @type {'interaction'} */ ('interaction'),
    allowedPaths: /** @type {string[]} */ ([]),
    excludedPaths: /** @type {string[]} */ ([]),
    allowLocalhost: false,
  };
  if (!siteConfig || typeof siteConfig !== 'object') return disabled;
  const site = /** @type {Record<string, unknown>} */ (siteConfig);
  const advertising = site.advertising && typeof site.advertising === 'object'
    ? /** @type {Record<string, unknown>} */ (site.advertising)
    : {};
  const hasModernConfig = Object.hasOwn(advertising, 'adsense');
  const raw = hasModernConfig ? advertising.adsense : site.adsense;
  if (!raw || (hasModernConfig && (typeof raw !== 'object' || Array.isArray(raw)))) return disabled;
  const options = typeof raw === 'object' && !Array.isArray(raw)
    ? /** @type {Record<string, unknown>} */ (raw)
    : {};
  if (hasModernConfig && options.enabled !== true) return disabled;
  if (!hasModernConfig && options.enabled === false) return disabled;

  const clientId = toAdsenseClientId(extractPublisher(raw));
  if (!clientId) return disabled;
  const publisherId = clientId.slice(3);
  const rawRecord = typeof raw === 'string' && raw.includes(',') ? raw.trim() : '';
  const suppliedRecord = typeof options.ads_txt === 'string' ? options.ads_txt.trim() : '';
  const adsTxtLine = suppliedRecord || rawRecord || `google.com, ${publisherId}, DIRECT`;

  return {
    enabled: true, clientId, publisherId, adsTxtLine,
    loadStrategy: options.load_strategy === 'immediate' ? 'immediate' : 'interaction',
    allowedPaths: Array.isArray(options.allowed_paths) ? options.allowed_paths.filter(x => typeof x === 'string') : [],
    excludedPaths: Array.isArray(options.excluded_paths) ? options.excluded_paths.filter(x => typeof x === 'string') : [],
    allowLocalhost: options.allow_localhost === true,
  };
}

/** @param {string} input */
function pathSegments(input) {
  const pathname = String(input ?? '').split(/[?#]/, 1)[0];
  return pathname.split('/').filter(Boolean);
}

/**
 * Match a configured path pattern. "*" matches one segment, "**" matches
 * zero or more segments. Other characters are matched literally.
 *
 * @param {string} pathname
 * @param {string} pattern
 */
export function matchesAdPath(pathname, pattern) {
  if (typeof pattern !== 'string' || !pattern.startsWith('/')) return false;
  const actual = pathSegments(pathname);
  const expected = pathSegments(pattern);
  /** @param {number} i @param {number} j @returns {boolean} */
  function walk(i, j) {
    if (i === expected.length) return j === actual.length;
    if (expected[i] === '**') {
      return walk(i + 1, j) || (j < actual.length && walk(i, j + 1));
    }
    return j < actual.length && (expected[i] === '*' || expected[i] === actual[j]) && walk(i + 1, j + 1);
  }
  return walk(0, 0);
}

/** @param {string} pathname @param {AdsenseSettings} settings */
export function isAdsensePathEligible(pathname, settings) {
  return settings.enabled && settings.allowedPaths.length > 0
    && settings.allowedPaths.some(pattern => matchesAdPath(pathname, pattern))
    && !settings.excludedPaths.some(pattern => matchesAdPath(pathname, pattern));
}
