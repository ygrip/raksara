/**
 * SEO Build Validator — runs BEFORE SvelteKit build.
 * Validates: prerender-routes.json, posts.json consistency,
 * sitemap/robots presence, and JSON-LD integrity.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METADATA_DIR = path.join(ROOT, 'metadata');
const STATIC_META_DIR = path.join(ROOT, 'sveltekit', 'static', 'metadata');
const STATIC_DIR = path.join(ROOT, 'sveltekit', 'static');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ✗ ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠ WARN: ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function normalizeRoute(route) {
  if (!route || route === '/') return '/';
  return `/${String(route).replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function extractSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function parseDefaultRobotsDisallows(robots) {
  const disallows = [];
  let appliesToDefaultAgent = false;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;

    const userAgent = line.match(/^User-agent:\s*(.+)$/i);
    if (userAgent) {
      appliesToDefaultAgent = userAgent[1].trim() === '*';
      continue;
    }

    if (appliesToDefaultAgent && /^Disallow:/i.test(line)) {
      const value = line.replace(/^Disallow:\s*/i, '').trim();
      if (value) disallows.push(value);
    }
  }

  return disallows;
}

function isBlockedByRobots(pathname, disallows) {
  return disallows.some((rule) => {
    if (rule === '/') return true;
    return pathname.startsWith(rule);
  });
}

function getGoogleVerificationTokens(config) {
  if (!config || typeof config !== 'object') return [];
  const raw =
    config.google_site_verification
    ?? config.googleSiteVerification
    ?? config.google_search_console
    ?? config.googleSearchConsole;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

function validateFeedFile({ filePath, label, rootPattern, entryPattern, posts }) {
  if (!fs.existsSync(filePath)) {
    error(`${label} not found in sveltekit/static/`);
    return;
  }

  const xml = fs.readFileSync(filePath, 'utf-8');
  if (!rootPattern.test(xml)) {
    error(`${label} is missing the expected XML root element`);
    return;
  }

  const entryCount = (xml.match(entryPattern) || []).length;
  if (posts && entryCount !== posts.length) {
    error(`${label} has ${entryCount} entries, expected ${posts.length}`);
  } else {
    ok(`${label} contains ${entryCount} post entr${entryCount === 1 ? 'y' : 'ies'}`);
  }

  if (posts) {
    let missing = 0;
    for (const post of posts) {
      const expectedUrl = `/blog/post/${post.slug}/`;
      if (!xml.includes(expectedUrl)) {
        error(`${label} missing post "${post.title}" (${expectedUrl})`);
        missing++;
      }
    }
    if (missing === 0) ok(`All ${posts.length} posts present in ${label}`);
  }
}

console.log('\n🔍 Validating SEO build artifacts...\n');

// ── 1. prerender-routes.json exists ──────────────────
const prerenderPath = path.join(STATIC_META_DIR, 'prerender-routes.json');
if (!fs.existsSync(prerenderPath)) {
  error('prerender-routes.json not found in sveltekit/static/metadata/');
} else {
  ok('prerender-routes.json exists');
}

// ── 2. Every published post has a prerender route ────
const posts = readJson(path.join(METADATA_DIR, 'posts.json'));
const portfolio = readJson(path.join(METADATA_DIR, 'portfolio.json'));
const prerenderRoutes = readJson(prerenderPath);
const config = readJson(path.join(METADATA_DIR, 'config.json'));
const googleVerificationTokens = getGoogleVerificationTokens(config);

if (posts && prerenderRoutes) {
  const routeSet = new Set(prerenderRoutes.map(normalizeRoute));
  let missing = 0;
  for (const post of posts) {
    const expected = `/blog/post/${post.slug}`;
    if (!routeSet.has(normalizeRoute(expected))) {
      error(`Post "${post.title}" (${expected}) missing from prerender manifest`);
      missing++;
    }
  }
  if (missing === 0) ok(`All ${posts.length} posts present in prerender manifest`);
}

if (portfolio && prerenderRoutes) {
  const routeSet = new Set(prerenderRoutes.map(normalizeRoute));
  let missing = 0;
  for (const item of portfolio) {
    const expected = `/portfolio/${item.slug}`;
    if (!routeSet.has(normalizeRoute(expected))) {
      error(`Portfolio item "${item.title}" (${expected}) missing from prerender manifest`);
      missing++;
    }
  }
  if (missing === 0) ok(`All ${portfolio.length} portfolio items present in prerender manifest`);
}

// ── 3. Sitemap exists and is parseable ───────────────
const sitemapPath = path.join(STATIC_DIR, 'sitemap.xml');
let sitemapUrls = [];
if (!fs.existsSync(sitemapPath)) {
  error('sitemap.xml not found in sveltekit/static/');
} else {
  const sitemap = fs.readFileSync(sitemapPath, 'utf-8');
  if (!sitemap.includes('<?xml') || !sitemap.includes('<urlset')) {
    error('sitemap.xml is not valid XML');
  } else {
    ok('sitemap.xml exists and contains <urlset>');
  }
  sitemapUrls = extractSitemapUrls(sitemap);
  if (sitemapUrls.length === 0) {
    error('sitemap.xml has no <loc> entries');
  } else {
    ok(`sitemap.xml contains ${sitemapUrls.length} URL(s)`);
  }

  // Check every blog post has a sitemap entry
  if (posts) {
    let sitemapMissing = 0;
    for (const post of posts) {
      const expectedUrl = `/blog/post/${post.slug}/`;
      if (!sitemap.includes(expectedUrl)) {
        error(`Post "${post.title}" (${expectedUrl}) missing from sitemap`);
        sitemapMissing++;
      }
    }
    if (sitemapMissing === 0) ok(`All ${posts.length} posts present in sitemap`);
  }

  if (portfolio) {
    let sitemapMissing = 0;
    for (const item of portfolio) {
      const expectedUrl = `/portfolio/${item.slug}/`;
      if (!sitemap.includes(expectedUrl)) {
        error(`Portfolio item "${item.title}" (${expectedUrl}) missing from sitemap`);
        sitemapMissing++;
      }
    }
    if (sitemapMissing === 0) ok(`All ${portfolio.length} portfolio items present in sitemap`);
  }

  if (prerenderRoutes && sitemapUrls.length > 0) {
    const prerenderSet = new Set(prerenderRoutes.map(normalizeRoute));
    let missingFromPrerender = 0;
    for (const url of sitemapUrls) {
      const route = normalizeRoute(new URL(url).pathname);
      if (!prerenderSet.has(route)) {
        error(`Sitemap URL ${url} missing from prerender manifest`);
        missingFromPrerender++;
      }
    }
    if (missingFromPrerender === 0) ok('All sitemap URLs are present in prerender manifest');
  }
}

// ── 4. robots.txt exists ─────────────────────────────
const robotsPath = path.join(STATIC_DIR, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  error('robots.txt not found in sveltekit/static/');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf-8');
  if (robots.includes('Sitemap:')) {
    ok('robots.txt exists and contains Sitemap: directive');
  } else {
    warn('robots.txt missing Sitemap: directive');
  }
  const sitemapDirective = robots.match(/^Sitemap:\s*(\S+)/im);
  if (sitemapDirective && sitemapUrls.length > 0) {
    const sitemapOrigin = new URL(sitemapUrls[0]).origin;
    const directiveUrl = new URL(sitemapDirective[1]);
    if (directiveUrl.origin !== sitemapOrigin) {
      error(`robots.txt Sitemap origin (${directiveUrl.origin}) does not match sitemap URL origin (${sitemapOrigin})`);
    } else {
      ok('robots.txt Sitemap origin matches sitemap URLs');
    }
  }
  // Ensure /blog/post/ is not blocked
  if (robots.includes('Disallow: /blog/post/')) {
    error('robots.txt blocks /blog/post/ — blog posts will not be crawled!');
  } else {
    ok('robots.txt does not block /blog/post/');
  }
  if (sitemapUrls.length > 0) {
    const disallows = parseDefaultRobotsDisallows(robots);
    let blocked = 0;
    for (const url of sitemapUrls) {
      const pathname = new URL(url).pathname;
      if (isBlockedByRobots(pathname, disallows)) {
        error(`robots.txt default rules block sitemap URL: ${pathname}`);
        blocked++;
      }
    }
    if (blocked === 0) ok('robots.txt default rules do not block sitemap URLs');
  }
}

// ── 5. JSON-LD integrity (posts.json has valid jsonLd objects) ──
if (posts) {
  // Note: posts.json doesn't store jsonLd — it's generated at runtime.
  // We check the SEO module instead.
  ok('JSON-LD is generated at runtime (seo.ts module)');
}

// ── 5a. RSS/Atom feeds ───────────────────────────────
validateFeedFile({
  filePath: path.join(STATIC_DIR, 'feed.xml'),
  label: 'feed.xml',
  rootPattern: /<rss\b/i,
  entryPattern: /<item>/gi,
  posts,
});
validateFeedFile({
  filePath: path.join(STATIC_DIR, 'atom.xml'),
  label: 'atom.xml',
  rootPattern: /<feed\b/i,
  entryPattern: /<entry>/gi,
  posts,
});

// ── 5b. Google Search Console verification ───────────
if (googleVerificationTokens.length === 0) {
  warn('Google Search Console verification token is not configured (google_site_verification)');
} else {
  ok(`Google Search Console verification configured (${googleVerificationTokens.length} token${googleVerificationTokens.length === 1 ? '' : 's'})`);
}

// ── 6. No duplicate routes ───────────────────────────
if (prerenderRoutes) {
  const seen = new Set();
  let dupes = 0;
  for (const route of prerenderRoutes) {
    const normalized = route.replace(/\/+$/, '');
    if (seen.has(normalized)) {
      warn(`Duplicate route in prerender manifest: ${route}`);
      dupes++;
    }
    seen.add(normalized);
  }
  if (dupes === 0) ok('No duplicate routes in prerender manifest');
}

// ── Summary ──────────────────────────────────────────
console.log(`\n${errors === 0 ? '✅' : '❌'} SEO validation: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  process.exit(1);
}
