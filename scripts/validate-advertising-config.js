const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'metadata', 'config.json');
const DEFAULT_LIBRARY_URL = 'https://acscdn.com/script/aclib.js';

function fail(message) {
  console.error(`  ✗ ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (error) {
    fail(`Unable to read metadata/config.json: ${error.message}`);
    return null;
  }
}

function clean(value) {
  return String(value ?? '').trim();
}

async function main() {
  const { resolveAdsenseConfig } = await import('../sveltekit/src/lib/advertising.js');
  console.log('\n📣 Validating advertising configuration...\n');

const config = readConfig();
const adcash = config?.advertising?.adcash;

if (!config || adcash?.enabled !== true) {
  if (config) ok('Adcash integration is disabled');
} else {
  const autoTag = adcash.auto_tag;
  const zoneId = clean(autoTag?.zone_id);
  const strategy = clean(adcash.load_strategy) || 'interaction';
  const libraryUrl = clean(adcash.library_url) || DEFAULT_LIBRARY_URL;

  if (autoTag?.enabled !== true) {
    fail('advertising.adcash is enabled but advertising.adcash.auto_tag.enabled is not true');
  }

  if (!zoneId) {
    fail('advertising.adcash.auto_tag.zone_id is required');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(zoneId)) {
    fail('advertising.adcash.auto_tag.zone_id may only contain letters, numbers, underscores, and hyphens');
  }

  if (!['immediate', 'interaction'].includes(strategy)) {
    fail('advertising.adcash.load_strategy must be immediate or interaction');
  }

  if (adcash.excluded_paths !== undefined) {
    if (!Array.isArray(adcash.excluded_paths)) {
      fail('advertising.adcash.excluded_paths must be an array of paths');
    } else {
      for (const [index, value] of adcash.excluded_paths.entries()) {
        const excludedPath = clean(value);
        if (!excludedPath.startsWith('/')) {
          fail(`advertising.adcash.excluded_paths[${index}] must start with /`);
        }
      }
    }
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(libraryUrl);
  } catch {
    fail('advertising.adcash.library_url must be a valid absolute URL');
  }

  if (parsedUrl && parsedUrl.protocol !== 'https:') {
    fail('advertising.adcash.library_url must use HTTPS');
  }

  if (!process.exitCode) {
    ok(`Adcash AutoTag configuration is valid (${zoneId}, ${strategy})`);
  }
}

// AdSense is optional. Validate only when a site explicitly configures it.
const modern = config?.advertising?.adsense;
const legacy = config?.adsense;
const active = modern === undefined ? legacy : modern;
if (active === undefined || active === null || active === false || modern?.enabled === false) {
  if (config) ok('AdSense is disabled (no publisher artifacts will be generated)');
} else {
  const adsense = resolveAdsenseConfig(config);
  if (modern !== undefined && (!modern || typeof modern !== 'object' || Array.isArray(modern))) {
    fail('advertising.adsense must be a settings object');
  } else if (modern !== undefined && modern.enabled !== true) {
    ok('AdSense is disabled (set advertising.adsense.enabled: true to opt in)');
  } else {
    if (!adsense.enabled) fail('Configured AdSense publisher ID is invalid or missing');
    if (adsense.enabled) {
      const parts = adsense.adsTxtLine.split(',').map(value => value.trim());
      if (/[\r\n]/.test(adsense.adsTxtLine) || parts.length < 3 || parts[1] !== adsense.publisherId || !['DIRECT', 'RESELLER'].includes(parts[2].toUpperCase())) {
        fail('AdSense ads_txt must authorize the configured publisher using a valid seller record');
      }
      if (adsense.allowedPaths.length === 0) ok('AdSense is in verification-only mode (no allowed_paths)');
      else ok(`AdSense is enabled for ${adsense.allowedPaths.length} configured path rule(s)`);
    }
    if (modern?.load_strategy !== undefined && !['immediate', 'interaction'].includes(modern.load_strategy)) {
      fail('advertising.adsense.load_strategy must be immediate or interaction');
    }
    if (modern?.allow_localhost !== undefined && typeof modern.allow_localhost !== 'boolean') {
      fail('advertising.adsense.allow_localhost must be a boolean');
    }
    for (const key of ['allowed_paths', 'excluded_paths']) {
      const patterns = modern?.[key];
      if (patterns === undefined) continue;
      if (!Array.isArray(patterns)) {
        fail(`advertising.adsense.${key} must be an array`);
        continue;
      }
      for (const pattern of patterns) {
        if (typeof pattern !== 'string' || !pattern.startsWith('/') || /[?#]/.test(pattern) ||
            pattern.split('/').some(part => part.includes('*') && part !== '*' && part !== '**')) {
          fail(`advertising.adsense.${key} contains an invalid URL path pattern`);
        }
      }
    }
  }
}

console.log(`\n${process.exitCode ? '❌' : '✅'} Advertising configuration validation complete.\n`);

}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
