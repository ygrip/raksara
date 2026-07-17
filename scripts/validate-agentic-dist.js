const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'metadata', 'config.json');
const STATIC_LLMS_PATH = path.join(ROOT, 'sveltekit', 'static', 'llms.txt');
const BUILD_LLMS_PATH = path.join(ROOT, 'sveltekit', 'build', 'llms.txt');

let errors = 0;
let warnings = 0;

function error(message) {
  console.error(`  ✗ ERROR: ${message}`);
  errors += 1;
}

function warn(message) {
  console.warn(`  ⚠ WARN: ${message}`);
  warnings += 1;
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

function validateLlmsFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    error(`${label} is missing`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!/^#\s+\S.+$/m.test(content)) error(`${label} is missing an H1 site title`);
  if (!/^>\s+\S.+$/m.test(content)) error(`${label} is missing a blockquote summary`);
  if (!/^##\s+\S.+$/m.test(content)) error(`${label} is missing an H2 link section`);
  if (!/^-\s+\[[^\]]+\]\(https?:\/\/[^)]+\)/m.test(content)) {
    error(`${label} does not contain an absolute Markdown link`);
  }
  if (/\]\(\//.test(content)) error(`${label} contains relative links`);

  if (errors === 0) ok(`${label} follows the expected llms.txt structure`);
}

console.log('\n🤖 Validating agentic browsing output...\n');

const config = readJson(CONFIG_PATH);
const agentic = config?.agentic;

if (config && agentic?.enabled !== true) {
  if (fs.existsSync(STATIC_LLMS_PATH) || fs.existsSync(BUILD_LLMS_PATH)) {
    error('llms.txt exists even though agentic browsing is disabled');
  } else {
    ok('Agentic browsing is disabled and no stale llms.txt is present');
  }
}

if (config && agentic?.enabled === true) {
  if (agentic.llms?.enabled === true) {
    validateLlmsFile(STATIC_LLMS_PATH, 'sveltekit/static/llms.txt');
    validateLlmsFile(BUILD_LLMS_PATH, 'sveltekit/build/llms.txt');
  } else if (fs.existsSync(STATIC_LLMS_PATH) || fs.existsSync(BUILD_LLMS_PATH)) {
    error('llms.txt exists even though agentic.llms is disabled');
  } else {
    ok('llms.txt generation is disabled without stale output');
  }

  if (agentic.webmcp?.enabled === true) {
    const search = agentic.webmcp.search;
    if (search?.enabled === true) {
      const name = String(search.name ?? '').trim();
      const description = String(search.description ?? '').trim();
      if (!name) error('agentic.webmcp.search.name is required');
      if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
        error('agentic.webmcp.search.name may only contain letters, numbers, underscores, and hyphens');
      }
      if (!description) error('agentic.webmcp.search.description is required');
      const maxResults = Number(search.max_results ?? 10);
      if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
        error('agentic.webmcp.search.max_results must be an integer from 1 to 20');
      }
      if (name && description && Number.isInteger(maxResults) && maxResults >= 1 && maxResults <= 20) {
        ok(`WebMCP search tool configuration is valid (${name})`);
      }
    } else {
      warn('WebMCP is enabled without the search tool');
    }

    if (!String(agentic.webmcp.origin_trial_token ?? '').trim()) {
      warn('WebMCP origin-trial token is empty; tool registration will remain inactive in browsers that require the trial');
    } else {
      ok('WebMCP origin-trial token is configured');
    }
  }
}

console.log(`\n${errors === 0 ? '✅' : '❌'} Agentic validation: ${errors} error(s), ${warnings} warning(s)\n`);
if (errors > 0) process.exit(1);
