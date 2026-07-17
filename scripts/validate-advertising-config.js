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

console.log(`\n${process.exitCode ? '❌' : '✅'} Advertising configuration validation complete.\n`);
