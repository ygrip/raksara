/**
 * SEO Dist Validator — runs AFTER SvelteKit build.
 * Validates generated static HTML files for SEO quality.
 */

const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'sveltekit', 'build');

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

console.log('\n🔍 Validating built static HTML...\n');

if (!fs.existsSync(BUILD_DIR)) {
  error(`Build directory not found: ${BUILD_DIR}`);
  process.exit(1);
}

// ── Find all blog post HTML files ────────────────────
async function main() {
  const blogPostFiles = await fg('blog/post/**/index.html', { cwd: BUILD_DIR, onlyFiles: true });

  if (blogPostFiles.length === 0) {
    warn('No blog post HTML files found in build output');
    return;
  }

  ok(`Found ${blogPostFiles.length} blog post HTML files`);

  let checked = 0;
  let jsonLdErrors = 0;
  let canonicalMissing = 0;

  for (const file of blogPostFiles.slice(0, 10)) {
    // Sample first 10 for speed
    const filePath = path.join(BUILD_DIR, file);
    const html = fs.readFileSync(filePath, 'utf-8');
    checked++;

    // Check <title>
    if (!/<title>[^<]+<\/title>/.test(html)) {
      error(`${file}: missing <title>`);
    }

    // Check meta description
    if (!/<meta\s+name="description"/i.test(html)) {
      error(`${file}: missing meta description`);
    }

    // Check canonical
    if (!/<link\s+rel="canonical"/i.test(html)) {
      error(`${file}: missing canonical link`);
      canonicalMissing++;
    }

    // Check JSON-LD is an object (not a string)
    const ldMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (ldMatch) {
      const ldContent = ldMatch[1].trim();
      if (ldContent.startsWith('"')) {
        error(`${file}: JSON-LD is a string (double-serialized), not an object`);
        jsonLdErrors++;
      } else if (ldContent.startsWith('{')) {
        try {
          const parsed = JSON.parse(ldContent);
          if (!parsed['@context'] || !parsed['@type']) {
            error(`${file}: JSON-LD missing @context or @type`);
            jsonLdErrors++;
          }
        } catch {
          error(`${file}: JSON-LD is not valid JSON`);
          jsonLdErrors++;
        }
      }
    } else {
      warn(`${file}: no JSON-LD script found`);
    }

    // Check article body has content
    if (!/<article[\s>]/.test(html)) {
      warn(`${file}: no <article> element found`);
    }
  }

  if (checked > 0) {
    if (jsonLdErrors === 0) ok(`JSON-LD valid in all ${checked} checked posts`);
    if (canonicalMissing === 0) ok(`Canonical links present in all ${checked} checked posts`);
  }

  // ── Summary ────────────────────────────────────────
  console.log(`\n${errors === 0 ? '✅' : '❌'} SEO dist validation: ${errors} error(s), ${warnings} warning(s)`);
  console.log(`   Checked ${checked} of ${blogPostFiles.length} blog post files\n`);

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
