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

/**
 * Generate a 1200×630 OG image for the profile page that mirrors the
 * "share profile" card visual: blurred cover backdrop, circular avatar
 * centered on the left, name / role / metadata chips on the right.
 *
 * @param {Object} params
 * @param {string} params.webDir  - sveltekit/static directory
 * @param {{ siteName, siteUrl, accentColor, logoAbsPath }} params.siteInfo
 * @param {{ name, role, avatarPath, coverPath, metadata }} params.profileData
 * @returns {Promise<Buffer>}  JPEG buffer
 */
async function generateProfileOgImage({ webDir, siteInfo, profileData }) {
  const W = 1200, H = 630;
  const { name = '', role = '', avatarPath, coverPath, metadata = [] } = profileData;
  const { siteName = 'Raksara', siteUrl = '', accentColor = '#6366f1', logoAbsPath = '' } = siteInfo;
  const accent = accentColor || '#6366f1';

  // ── 1. Load source images ─────────────────────────────────────────────────
  const [coverBuf, avatarBuf] = await Promise.all([
    loadSourceImage(coverPath, webDir),
    loadSourceImage(avatarPath, webDir),
  ]);

  // ── 2. Backdrop: blurred cover (heavy blur + heavy dark) or gradient ──────
  let backdrop;
  if (coverBuf) {
    backdrop = await sharp(coverBuf)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .blur(32)
      .modulate({ brightness: 0.28, saturation: 0.55 })
      .jpeg({ quality: 55 })
      .toBuffer();
  } else {
    const gradSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#030712"/>
          <stop offset="58%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <radialGradient id="glow1" cx="20%" cy="18%" r="46%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#glow1)"/>
    </svg>`;
    backdrop = await sharp(Buffer.from(gradSvg)).jpeg({ quality: 82 }).toBuffer();
  }

  // ── 3. Layout constants ───────────────────────────────────────────────────
  const m = 20;
  const cardX = m, cardY = m;
  const cardW = W - m * 2;   // 1160
  const cardH = H - m * 2;   // 590
  const footerH = 76;
  const contentH = cardH - footerH;   // 514
  const leftColW = 320;
  const divX = cardX + leftColW;
  const rightX = divX + 1;
  const rightW = cardW - leftColW - 1;
  const avatarSize = 200;
  const avatarCX = cardX + Math.round(leftColW / 2);   // 180
  const avatarCY = cardY + Math.round(contentH / 2);   // 277
  const cardR = 18;  // card corner radius

  // ── 4. Text layout (right column) ────────────────────────────────────────
  const chips = (Array.isArray(metadata) ? metadata : []).slice(0, 3).map(item =>
    typeof item === 'string' ? item : [item.label, item.value].filter(Boolean).join(' : ')
  );
  const chipH = 40, chipGap = 12;
  const textBlockH = 50 + 32 + 22 + chips.length * (chipH + chipGap);
  const textStartY = cardY + Math.round((contentH - textBlockH) / 2);
  const nameY = textStartY + 42;
  const roleY = nameY + 52;
  const firstChipY = roleY + 38;

  // ── 5. Logo: load SVG and colorize with accent color ─────────────────────
  let logoPngBuf = null;
  const logoSize = 38;
  if (logoAbsPath && fs.existsSync(logoAbsPath)) {
    try {
      const logoSvgRaw = fs.readFileSync(logoAbsPath, 'utf-8');
      // Colorize currentColor → accent, set explicit size
      const logoColored = logoSvgRaw
        .replace(/currentColor/g, accent)
        .replace(/<svg([^>]*)>/, (_, attrs) => {
          // Inject width/height; preserve viewBox
          const cleaned = attrs.replace(/\s*(width|height)="[^"]*"/g, '');
          return `<svg${cleaned} width="${logoSize}" height="${logoSize}">`;
        });
      logoPngBuf = await sharp(Buffer.from(logoColored))
        .resize(logoSize, logoSize)
        .png()
        .toBuffer();
    } catch { /* non-fatal: skip logo */ }
  }

  // ── 6. Left-column cover: softly blurred + dimmed crop ───────────────────
  // Composited over the white card to give the avatar a moody photo backdrop.
  // Clipped to the card's left column with rounded top-left + bottom-left corners.
  let leftColCoverComposite = null;
  if (coverBuf) {
    const lcW = leftColW, lcH = contentH;
    // Moderate blur (lighter than backdrop) and dim
    const blurred = await sharp(coverBuf)
      .resize(lcW, lcH, { fit: 'cover', position: 'centre' })
      .blur(12)
      .modulate({ brightness: 0.50, saturation: 0.80 })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Clip mask: rounded top-left and bottom-left, square top-right and bottom-right
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lcW}" height="${lcH}">
      <path d="M${cardR},0 L${lcW},0 L${lcW},${lcH} L${cardR},${lcH}
               A${cardR},${cardR} 0 0 1 0,${lcH - cardR}
               L0,${cardR}
               A${cardR},${cardR} 0 0 1 ${cardR},0 Z" fill="white"/>
    </svg>`;
    const clipped = await sharp(blurred)
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer();
    leftColCoverComposite = { input: clipped, left: cardX, top: cardY };
  }

  // ── 7. Build chip SVG elements ────────────────────────────────────────────
  const rPad = 36;
  const maxChipW = rightW - rPad * 2;
  let chipsSvg = '';
  chips.forEach((text, i) => {
    const chipW = Math.min(text.length * 11 + 48, maxChipW);
    const cx2 = rightX + rPad;
    const cy2 = firstChipY + i * (chipH + chipGap);
    chipsSvg += `
      <rect x="${cx2}" y="${cy2}" width="${chipW}" height="${chipH}" rx="${chipH / 2}"
        fill="#eefdf4" stroke="${accent}" stroke-opacity="0.3" stroke-width="1.5"/>
      <text x="${cx2 + 24}" y="${cy2 + 26}"
        font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
        font-size="18" font-weight="700" fill="${accent}">${escSvg(text)}</text>`;
  });

  // ── 8. Logo element for footer SVG ───────────────────────────────────────
  const logoX = cardX + 14;
  const logoY = cardY + contentH + Math.round((footerH - logoSize) / 2);
  const brandX = logoPngBuf ? logoX + logoSize + 12 : cardX + 52;
  let logoSvgEl = '';
  if (logoPngBuf) {
    const b64 = logoPngBuf.toString('base64');
    logoSvgEl = `<image href="data:image/png;base64,${b64}"
      x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`;
  }

  // ── 9. Composite order ────────────────────────────────────────────────────
  //  Layer 0  backdrop (blurred cover or gradient)  ← sharp base
  //  Layer 1  cardBgSvg  — dark overlay + white card + accent stripe
  //  Layer 2  leftColCoverComposite  — blurred cover clipped to left col
  //  Layer 3  overlayAndTextSvg  — left-col dark veil, avatar ring, text, footer

  // Layer 1 — card background (no left-col fill; cover layer handles it)
  const cardBgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.75"/>
      </linearGradient>
    </defs>
    <!-- Dark overlay on backdrop -->
    <rect width="${W}" height="${H}" fill="rgba(2,6,23,0.36)"/>
    <!-- White card -->
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}"
      fill="rgba(255,255,255,0.97)"/>
    <!-- Accent stripe on left edge -->
    <rect x="${cardX}" y="${cardY + 22}" width="6" height="${cardH - 44}" rx="3"
      fill="url(#acc)"/>
  </svg>`;

  // Layer 3 — dark veil over left col, avatar ring, right-col text, footer
  const overlayAndTextSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <clipPath id="lc-clip">
        <path d="M${cardX + cardR},${cardY}
                 L${divX},${cardY} L${divX},${cardY + contentH}
                 L${cardX + cardR},${cardY + contentH}
                 A${cardR},${cardR} 0 0 1 ${cardX},${cardY + contentH - cardR}
                 L${cardX},${cardY + cardR}
                 A${cardR},${cardR} 0 0 1 ${cardX + cardR},${cardY} Z"/>
      </clipPath>
      <clipPath id="card-clip">
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}"/>
      </clipPath>
    </defs>

    <!-- Left column: dark veil over the blurred cover (or fallback gradient tint) -->
    ${coverBuf
      ? `<rect x="${cardX}" y="${cardY}" width="${leftColW}" height="${contentH}"
           fill="rgba(2,6,23,0.42)" clip-path="url(#lc-clip)"/>`
      : `<rect x="${cardX}" y="${cardY}" width="${leftColW}" height="${contentH}"
           fill="rgba(248,250,252,0.82)" clip-path="url(#lc-clip)"/>`}

    <!-- Left/right divider -->
    <line x1="${divX}" y1="${cardY + 28}" x2="${divX}" y2="${cardY + contentH - 28}"
      stroke="${coverBuf ? 'rgba(255,255,255,0.15)' : 'rgba(226,232,240,0.9)'}"
      stroke-width="1"/>

    <!-- Avatar white ring -->
    <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarSize / 2 + 9}" fill="white" fill-opacity="0.95"/>
    <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarSize / 2 + 5}"
      fill="${accent}" fill-opacity="0.14"/>

    <!-- Name -->
    <text x="${rightX + rPad}" y="${nameY}"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
      font-size="42" font-weight="800" fill="#111827">${escSvg(name)}</text>

    <!-- Role -->
    <text x="${rightX + rPad}" y="${roleY}"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
      font-size="22" font-weight="500" fill="#64748b">${escSvg(role)}</text>

    <!-- Chips -->
    ${chipsSvg}

    <!-- Footer background (full width, including left col bottom) -->
    <rect x="${cardX}" y="${cardY + contentH}" width="${cardW}" height="${footerH}"
      fill="rgba(248,250,252,0.92)" clip-path="url(#card-clip)"/>
    <line x1="${cardX}" y1="${cardY + contentH}" x2="${cardX + cardW}" y2="${cardY + contentH}"
      stroke="rgba(226,232,240,0.8)" stroke-width="1"/>

    <!-- Footer: logo (embedded PNG) -->
    ${logoSvgEl}

    <!-- Footer: site brand name -->
    <text x="${brandX}" y="${cardY + contentH + 47}"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
      font-size="26" font-weight="800" fill="#0f172a">${escSvg(siteName)}</text>

    <!-- Footer: site URL (right-aligned) -->
    <text x="${cardX + cardW - 36}" y="${cardY + contentH + 47}"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
      font-size="16" font-weight="400" fill="#94a3b8" text-anchor="end">${escSvg(siteUrl)}</text>
  </svg>`;

  // ── 10. Circular avatar ────────────────────────────────────────────────────
  const aSize = avatarSize;
  let avatarComposite;
  if (avatarBuf) {
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${aSize}" height="${aSize}">
      <circle cx="${aSize / 2}" cy="${aSize / 2}" r="${aSize / 2}" fill="white"/>
    </svg>`;
    const circularAvatar = await sharp(avatarBuf)
      .resize(aSize, aSize, { fit: 'cover', position: 'centre' })
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer();
    avatarComposite = {
      input: circularAvatar,
      left: Math.round(avatarCX - aSize / 2),
      top: Math.round(avatarCY - aSize / 2),
    };
  } else {
    const initial = escSvg((name || 'R').charAt(0).toUpperCase());
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${aSize}" height="${aSize}">
      <circle cx="${aSize / 2}" cy="${aSize / 2}" r="${aSize / 2}" fill="${accent}"/>
      <text x="${aSize / 2}" y="${aSize / 2 + 22}"
        font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
        font-size="80" font-weight="800" fill="white" text-anchor="middle">${initial}</text>
    </svg>`;
    avatarComposite = {
      input: await sharp(Buffer.from(fallbackSvg)).png().toBuffer(),
      left: Math.round(avatarCX - aSize / 2),
      top: Math.round(avatarCY - aSize / 2),
    };
  }

  // ── 11. Final composite ───────────────────────────────────────────────────
  const composites = [
    { input: Buffer.from(cardBgSvg), top: 0, left: 0 },
    ...(leftColCoverComposite ? [leftColCoverComposite] : []),
    { input: Buffer.from(overlayAndTextSvg), top: 0, left: 0 },
    avatarComposite,
  ];

  return sharp(backdrop)
    .composite(composites)
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toBuffer();
}

module.exports = { generateOgImages, generateProfileOgImage, OG_SIZES, OG_DIR_NAME };
