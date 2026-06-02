/**
 * SEO Dist Validator - runs AFTER SvelteKit build.
 * Validates generated static HTML for every URL advertised in sitemap.xml.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'sveltekit', 'build');
const STATIC_DIR = path.join(ROOT, 'sveltekit', 'static');
const SITEMAP_PATH = path.join(STATIC_DIR, 'sitemap.xml');
const ROBOTS_PATH = path.join(STATIC_DIR, 'robots.txt');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  x ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ! WARN: ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  OK ${msg}`);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function extractSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function htmlPathForUrl(url) {
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/') return path.join(BUILD_DIR, 'index.html');
  return path.join(BUILD_DIR, pathname.replace(/^\/+/, ''), 'index.html');
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : '';
}

function hasNoindex(html) {
  const robots = firstMatch(
    html,
    /<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  return /\bnoindex\b/i.test(robots);
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

console.log('\nValidating built static HTML for SEO...\n');

if (!fs.existsSync(BUILD_DIR)) {
  error(`Build directory not found: ${BUILD_DIR}`);
  process.exit(1);
}

if (!fs.existsSync(SITEMAP_PATH)) {
  error(`sitemap.xml not found: ${SITEMAP_PATH}`);
  process.exit(1);
}

const sitemapUrls = extractSitemapUrls(readFile(SITEMAP_PATH));
if (sitemapUrls.length === 0) {
  error('sitemap.xml has no <loc> entries');
  process.exit(1);
}

const robotsText = fs.existsSync(ROBOTS_PATH) ? readFile(ROBOTS_PATH) : '';
const disallows = parseDefaultRobotsDisallows(robotsText);
if (!robotsText) warn('robots.txt not found; skipping robots block checks');

let checked = 0;
let missingHtml = 0;
let missingTitle = 0;
let missingDescription = 0;
let missingCanonical = 0;
let noindexCount = 0;
let jsonLdErrors = 0;
let robotsBlocked = 0;
let duplicateCanonical = 0;
let duplicateDescription = 0;
let duplicateRobots = 0;

for (const url of sitemapUrls) {
  const parsed = new URL(url);
  const filePath = htmlPathForUrl(url);
  const relativeFile = path.relative(BUILD_DIR, filePath);

  if (!fs.existsSync(filePath)) {
    error(`${parsed.pathname}: sitemap URL missing built HTML (${relativeFile})`);
    missingHtml++;
    continue;
  }

  const html = readFile(filePath);
  checked++;

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    error(`${relativeFile}: missing <title>`);
    missingTitle++;
  }

  if (!/<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html)) {
    error(`${relativeFile}: missing meta description`);
    missingDescription++;
  }

  if (!/<link\s+[^>]*rel=["']canonical["'][^>]*href=["'][^"']+["'][^>]*>/i.test(html)) {
    error(`${relativeFile}: missing canonical link`);
    missingCanonical++;
  }

  if (hasNoindex(html)) {
    error(`${relativeFile}: sitemap URL renders robots noindex`);
    noindexCount++;
  }

  const canonicalCount = countMatches(html, /<link\s+[^>]*rel=["']canonical["'][^>]*>/gi);
  if (canonicalCount > 1) {
    error(`${relativeFile}: has ${canonicalCount} canonical links`);
    duplicateCanonical++;
  }

  const descriptionCount = countMatches(html, /<meta\s+[^>]*name=["']description["'][^>]*>/gi);
  if (descriptionCount > 1) {
    error(`${relativeFile}: has ${descriptionCount} meta descriptions`);
    duplicateDescription++;
  }

  const robotsCount = countMatches(html, /<meta\s+[^>]*name=["']robots["'][^>]*>/gi);
  if (robotsCount !== 1) {
    error(`${relativeFile}: expected exactly one robots meta tag, found ${robotsCount}`);
    duplicateRobots++;
  }

  for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const ldContent = match[1].trim();
    if (!ldContent) {
      error(`${relativeFile}: empty JSON-LD script`);
      jsonLdErrors++;
      continue;
    }
    if (ldContent.startsWith('"')) {
      error(`${relativeFile}: JSON-LD is double-serialized`);
      jsonLdErrors++;
      continue;
    }
    try {
      const parsedLd = JSON.parse(ldContent);
      if (!parsedLd['@context'] || !parsedLd['@type']) {
        error(`${relativeFile}: JSON-LD missing @context or @type`);
        jsonLdErrors++;
      }
    } catch {
      error(`${relativeFile}: JSON-LD is not valid JSON`);
      jsonLdErrors++;
    }
  }

  if (robotsText && isBlockedByRobots(parsed.pathname, disallows)) {
    error(`${parsed.pathname}: sitemap URL is blocked by robots.txt`);
    robotsBlocked++;
  }
}

if (checked > 0) {
  ok(`Checked ${checked} built sitemap URL(s)`);
}
if (missingHtml === 0) ok('Every sitemap URL has built HTML');
if (missingTitle === 0) ok('Titles are present on all checked pages');
if (missingDescription === 0) ok('Meta descriptions are present on all checked pages');
if (missingCanonical === 0) ok('Canonical links are present on all checked pages');
if (duplicateCanonical === 0) ok('Canonical links are unique on all checked pages');
if (duplicateDescription === 0) ok('Meta descriptions are unique on all checked pages');
if (duplicateRobots === 0) ok('Robots meta tags are unique on all checked pages');
if (noindexCount === 0) ok('No sitemap URL renders robots noindex');
if (jsonLdErrors === 0) ok('JSON-LD scripts are valid where present');
if (robotsBlocked === 0 && robotsText) ok('robots.txt does not block sitemap URLs');

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'} SEO dist validation: ${errors} error(s), ${warnings} warning(s)`);
console.log(`   Sitemap URLs: ${sitemapUrls.length}; checked HTML files: ${checked}\n`);

if (errors > 0) {
  process.exit(1);
}
