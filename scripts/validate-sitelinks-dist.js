const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATIC_METADATA_DIR = path.join(ROOT, 'sveltekit', 'static', 'metadata');
const BUILD_DIR = path.join(ROOT, 'sveltekit', 'build');
const SITELINKS_PATH = path.join(STATIC_METADATA_DIR, 'sitelinks.json');
const HOME_PATH = path.join(BUILD_DIR, 'index.html');

let errors = 0;

function error(message) {
  console.error(`  ✗ ERROR: ${message}`);
  errors += 1;
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (cause) {
    error(`Unable to read ${path.relative(ROOT, filePath)}: ${cause.message}`);
    return null;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAnchor(html, href, label) {
  const hrefPattern = escapeRegex(href.replace(/\/$/, '')) + '/?';
  const labelPattern = escapeRegex(label).replace(/\s+/g, '\\s+');
  const anchorPattern = new RegExp(
    `<a\\b[^>]*href=["']${hrefPattern}["'][^>]*>[\\s\\S]*?${labelPattern}[\\s\\S]*?<\\/a>`,
    'i',
  );
  return anchorPattern.test(html);
}

function extractJsonLdBlocks(html) {
  return Array.from(html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .flatMap((content) => {
      try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });
}

function findWebSiteSchema(blocks) {
  for (const block of blocks) {
    if (block?.['@type'] === 'WebSite') return block;
    if (Array.isArray(block?.['@graph'])) {
      const website = block['@graph'].find((node) => node?.['@type'] === 'WebSite');
      if (website) return website;
    }
  }
  return null;
}

console.log('\n🔗 Validating sitelink signals...\n');

if (!fs.existsSync(SITELINKS_PATH)) {
  ok('Sitelink candidates are not configured; skipping sitelink validation');
  process.exit(0);
}

const config = readJson(SITELINKS_PATH);
if (!config) process.exit(1);
if (!fs.existsSync(HOME_PATH)) {
  error('Built homepage is missing');
  process.exit(1);
}

const html = fs.readFileSync(HOME_PATH, 'utf-8');
const links = Array.isArray(config.links) ? config.links : [];

if (links.length < 2) {
  error('At least two sitelink candidates are required');
}

for (const link of links) {
  if (!hasAnchor(html, link.href, link.label)) {
    error(`Homepage does not contain a visible anchor for sitelink candidate "${link.label}" (${link.href})`);
  }
}
if (links.length > 0 && errors === 0) {
  ok(`Homepage renders all ${links.length} sitelink candidate anchors`);
}

const website = findWebSiteSchema(extractJsonLdBlocks(html));
if (!website) {
  error('Homepage is missing WebSite JSON-LD');
} else {
  if (website.name !== config.siteName) {
    error(`WebSite schema name "${website.name ?? ''}" does not match configured site name "${config.siteName ?? ''}"`);
  } else {
    ok(`WebSite schema uses configured site name: ${config.siteName}`);
  }

  const expectedAlternates = Array.isArray(config.alternateNames) ? config.alternateNames : [];
  const actualAlternates = Array.isArray(website.alternateName)
    ? website.alternateName
    : website.alternateName
      ? [website.alternateName]
      : [];
  const missingAlternates = expectedAlternates.filter((name) => !actualAlternates.includes(name));
  if (missingAlternates.length > 0) {
    error(`WebSite schema is missing alternate name(s): ${missingAlternates.join(', ')}`);
  } else if (expectedAlternates.length > 0) {
    ok(`WebSite schema includes ${expectedAlternates.length} alternate site name(s)`);
  }
}

console.log(`\n${errors === 0 ? '✅' : '❌'} Sitelink validation: ${errors} error(s)\n`);
if (errors > 0) process.exit(1);
