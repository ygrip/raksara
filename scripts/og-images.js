// scripts/og-images.js
// Build-time OG image generator for Raksara.
// Generates landscape (1200x630) and portrait (1080x1350) OG images for each content page.
// If a cover image exists: center it (contain) and fill remaining space with a blurred/darkened
// version of the same image (blur-up fill). If no cover: render a type-specific SVG default.

'use strict';
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const OG_SIZES = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
};

// Output directory (relative to sveltekit/static)
const OG_DIR_NAME = 'og';

/**
 * Generate an OG image from a source image buffer using blur-up fill.
 * - Resize source to fit within target (contain, centered)
 * - If source doesn't fill target: use blurred+darkened version as background
 * - Returns JPEG buffer
 */
async function buildOgImage(sourceBuffer, targetW, targetH) {
  const meta = await sharp(sourceBuffer).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  // Scale to fit inside target
  const scale = Math.min(targetW / srcW, targetH / srcH);
  const fittedW = Math.round(srcW * scale);
  const fittedH = Math.round(srcH * scale);

  const contained = await sharp(sourceBuffer)
    .resize(fittedW, fittedH, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  // If source perfectly fills target, just output
  if (fittedW === targetW && fittedH === targetH) {
    return sharp(contained)
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer();
  }

  // Create blurred background: fill (cover), blur heavily, darken
  const blurBg = await sharp(sourceBuffer)
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .blur(48)
    .modulate({ saturation: 0.55, brightness: 0.42 })
    .jpeg({ quality: 50 })
    .toBuffer();

  // Composite contained image centered on blurred background
  const left = Math.round((targetW - fittedW) / 2);
  const top = Math.round((targetH - fittedH) / 2);

  return sharp(blurBg)
    .composite([{ input: contained, left, top }])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
}

/**
 * Generate a default SVG base image for a given content type + site info.
 * Used when no cover image is available.
 */
function buildDefaultSvg(targetW, targetH, { type, siteName, siteUrl, accentColor }) {
  const isLandscape = targetW > targetH;
  const cx = targetW / 2;
  const cy = targetH / 2;

  // Type label map
  const typeLabels = {
    blog: 'BLOG POST',
    article: 'BLOG POST',
    novel: 'NOVEL',
    poem: 'POEM',
    comic: 'COMIC',
    portfolio: 'PROJECT',
    gallery: 'GALLERY',
    thoughts: 'THOUGHTS',
    pages: 'PAGE',
    profile: 'PROFILE',
    default: 'CONTENT',
  };
  const typeLabel = typeLabels[type] || typeLabels.default;

  // Accent fallback
  const accent = accentColor || '#6366f1';

  // Badge dimensions (estimated)
  const badgeText = typeLabel;
  const charWidth = 9.5; // approx per char at font-size 15
  const badgePadH = 20;
  const badgeW = Math.round(badgeText.length * charWidth + badgePadH * 2);
  const badgeH = 36;
  const badgeX = cx - badgeW / 2;
  const badgeY = isLandscape ? cy + 52 : cy + 80;
  const titleY = isLandscape ? cy - 10 : cy + 20;
  const urlY = isLandscape ? targetH - 52 : targetH - 72;
  const urlFontSize = isLandscape ? 22 : 24;
  const titleFontSize = isLandscape ? 68 : 60;
  const lineY1 = isLandscape ? 60 : 80;
  const lineH = 4;

  // Dot pattern size
  const dotSpacing = 36;

  // Build dot pattern SVG for subtle grid
  const dotPatternId = 'rk-dots';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${targetW}" height="${targetH}" viewBox="0 0 ${targetW} ${targetH}">
  <defs>
    <linearGradient id="rk-bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b26"/>
    </linearGradient>
    <pattern id="${dotPatternId}" x="0" y="0" width="${dotSpacing}" height="${dotSpacing}" patternUnits="userSpaceOnUse">
      <circle cx="${dotSpacing / 2}" cy="${dotSpacing / 2}" r="1.2" fill="#ffffff" fill-opacity="0.06"/>
    </pattern>
    <linearGradient id="rk-accent-glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${targetW}" height="${targetH}" fill="url(#rk-bg)"/>
  <rect width="${targetW}" height="${targetH}" fill="url(#${dotPatternId})"/>
  <!-- Top accent glow -->
  <rect x="0" y="0" width="${targetW}" height="120" fill="url(#rk-accent-glow)" fill-opacity="0.4"/>
  <!-- Top accent line -->
  <rect x="0" y="0" width="${targetW}" height="${lineH}" fill="${accent}"/>
  <!-- Site name -->
  <text x="${cx}" y="${titleY}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="${titleFontSize}" font-weight="700" fill="#ffffff" fill-opacity="0.92" text-anchor="middle" dominant-baseline="central">${escSvg(siteName)}</text>
  <!-- Type badge background -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeH / 2}" fill="${accent}" fill-opacity="0.18"/>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeH / 2}" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.2" fill="none"/>
  <!-- Type badge label -->
  <text x="${cx}" y="${badgeY + badgeH / 2}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="15" font-weight="600" fill="${accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="3">${escSvg(typeLabel)}</text>
  <!-- Site URL -->
  <text x="${cx}" y="${urlY}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="${urlFontSize}" fill="#ffffff" fill-opacity="0.28" text-anchor="middle" dominant-baseline="central">${escSvg(siteUrl)}</text>
</svg>`;
}

function escSvg(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Load a source image from a content path, resolving relative paths from WEB_DIR.
 * Returns a buffer or null if not found.
 */
/**
 * Download an image from an external http/https URL.
 * Returns a buffer or null on failure. Follows up to 3 redirects.
 */
function fetchExternalImage(url, redirectsLeft = 3) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        resolve(fetchExternalImage(res.headers.location, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Load a source image from a content path or external URL, resolving local
 * paths relative to webDir. Returns a buffer or null if not found/readable.
 */
async function loadSourceImage(coverPath, webDir) {
  if (!coverPath) return null;

  // External URL — download at build time so OG generation uses the real image
  if (/^https?:\/\//i.test(coverPath)) {
    try {
      const buf = await fetchExternalImage(coverPath);
      if (!buf) return null;
      await sharp(buf).metadata(); // validate it's a real image
      return buf;
    } catch {
      return null;
    }
  }

  const bare = String(coverPath).replace(/^\/+/, '');

  // Try multiple candidate paths to handle both legacy (content/ prefix) and
  // new-style admin uploads (no content/ prefix) gracefully.
  const candidates = [
    path.join(webDir, bare),
    // New admin: cover stored as /assets/... → look under content/
    !bare.startsWith('content/') ? path.join(webDir, 'content', bare) : null,
    // Legacy double-nesting guard: content/content/assets/...
    bare.startsWith('content/content/') ? path.join(webDir, bare.replace(/^content\//, '')) : null,
  ].filter(Boolean);

  for (const fullPath of candidates) {
    if (!fs.existsSync(fullPath)) continue;
    try {
      const buf = fs.readFileSync(fullPath);
      await sharp(buf).metadata();
      return buf;
    } catch {
      // Not a valid image at this path, try next
    }
  }
  return null;
}

/**
 * Compute a cache key from source image buffer (or null) + type + size
 */
function cacheKey(sourceHash, type, w, h) {
  return `${sourceHash || 'default'}-${type}-${w}x${h}`;
}

function hashBuffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
}

/**
 * Main entry point.
 * @param {Object} params
 * @param {string} params.webDir - sveltekit/static directory
 * @param {Array} params.entries - Array of { type, subtype, slug, coverPath }
 * @param {Object} params.siteInfo - { siteName, siteUrl, accentColor }
 * @returns {Map<string, { landscape: string, portrait: string }>} Map of slug → og paths
 */
async function generateOgImages({ webDir, entries, siteInfo }) {
  const ogDir = path.join(webDir, OG_DIR_NAME);
  const manifestPath = path.join(ogDir, '.manifest.json');
  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch {}
  }
  let changed = false;

  // Pre-generate default SVG buffers per type (lazy, cached by type+size)
  const defaultBufCache = new Map();
  async function getDefaultBuffer(type, w, h) {
    const k = `${type}-${w}x${h}`;
    if (defaultBufCache.has(k)) return defaultBufCache.get(k);
    const svg = buildDefaultSvg(w, h, { type, ...siteInfo });
    const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 82, progressive: true }).toBuffer();
    defaultBufCache.set(k, buf);
    return buf;
  }

  // Generate defaults directory
  const defaultsDir = path.join(ogDir, 'defaults');
  fs.mkdirSync(defaultsDir, { recursive: true });

  // Results map: key = `${type}/${slug}` → { landscape, portrait }
  const results = new Map();

  for (const entry of entries) {
    const { type, subtype, slug, coverPath } = entry;
    const effectiveType = subtype || type;
    const slugKey = `${type}/${slug}`;

    // Load cover image buffer
    const sourceBuffer = await loadSourceImage(coverPath, webDir);
    const sourceHash = sourceBuffer ? hashBuffer(sourceBuffer) : null;

    const typeDir = path.join(ogDir, type);
    fs.mkdirSync(typeDir, { recursive: true });

    const paths = {};
    for (const [variant, { width, height }] of Object.entries(OG_SIZES)) {
      const ck = cacheKey(sourceHash, effectiveType, width, height);
      const outFile = `${slug.replace(/\//g, '-')}-${variant}.jpg`;
      const outPath = path.join(typeDir, outFile);
      const webPath = `/og/${type}/${outFile}`;

      // Check cache
      if (manifest[`${slugKey}-${variant}`] === ck && fs.existsSync(outPath)) {
        paths[variant] = webPath;
        continue;
      }

      // Generate
      let imgBuffer = sourceBuffer
        ? await buildOgImage(sourceBuffer, width, height)
        : await buildOgImage(await getDefaultBuffer(effectiveType, width, height), width, height);

      fs.writeFileSync(outPath, imgBuffer);
      manifest[`${slugKey}-${variant}`] = ck;
      paths[variant] = webPath;
      changed = true;
    }
    results.set(slugKey, paths);
  }

  // Generate default images for each type (for pages without entries like tag/category pages)
  const defaultTypes = ['blog', 'novel', 'poem', 'comic', 'portfolio', 'gallery', 'thoughts', 'pages', 'profile'];
  for (const t of defaultTypes) {
    for (const [variant, { width, height }] of Object.entries(OG_SIZES)) {
      const ck = cacheKey(null, t, width, height);
      const outFile = `${t}-${variant}.jpg`;
      const outPath = path.join(defaultsDir, outFile);
      const manifestKey = `default-${t}-${variant}`;
      if (manifest[manifestKey] === ck && fs.existsSync(outPath)) continue;
      const buf = await getDefaultBuffer(t, width, height);
      fs.writeFileSync(outPath, buf);
      manifest[manifestKey] = ck;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return results;
}

module.exports = { generateOgImages, OG_SIZES, OG_DIR_NAME };
