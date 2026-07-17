const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'metadata', 'config.json');
const STATIC_LLMS_PATH = path.join(ROOT, 'sveltekit', 'static', 'llms.txt');
const BUILD_LLMS_PATH = path.join(ROOT, 'sveltekit', 'build', 'llms.txt');
const STATIC_ORIGIN_TRIAL_SCRIPT = path.join(ROOT, 'sveltekit', 'static', 'webmcp-origin-trial.js');
const BUILD_ORIGIN_TRIAL_SCRIPT = path.join(ROOT, 'sveltekit', 'build', 'webmcp-origin-trial.js');
const BUILD_HOME_PATH = path.join(ROOT, 'sveltekit', 'build', 'index.html');

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

function decodeOriginTrialPayload(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const start = decoded.indexOf('{');
    const end = decoded.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(decoded.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validateOriginTrialToken(config, token) {
  const payload = decodeOriginTrialPayload(token);
  if (!payload) {
    warn('Origin-trial token payload could not be decoded; Chrome remains the source of truth');
    return;
  }

  if (payload.feature !== 'WebMCP') {
    error(`Origin-trial token is for ${payload.feature ?? 'an unknown feature'}, not WebMCP`);
  }

  const configuredSiteUrl = String(config.site_url ?? config.url ?? '').trim();
  if (configuredSiteUrl && payload.origin) {
    try {
      const expectedOrigin = new URL(configuredSiteUrl).origin;
      const tokenOrigin = new URL(payload.origin).origin;
      if (expectedOrigin !== tokenOrigin) {
        error(`Origin-trial token origin ${tokenOrigin} does not match configured site origin ${expectedOrigin}`);
      } else {
        ok(`Origin-trial token matches ${expectedOrigin}`);
      }
    } catch {
      warn('Unable to compare configured site URL with origin-trial token origin');
    }
  }

  if (Number.isFinite(payload.expiry)) {
    const expiryMs = Number(payload.expiry) * 1000;
    if (expiryMs <= Date.now()) {
      error(`Origin-trial token expired on ${new Date(expiryMs).toISOString()}`);
    } else {
      ok(`Origin-trial token expires on ${new Date(expiryMs).toISOString()}`);
    }
  }

  if (payload.isThirdParty === true) {
    ok('Origin-trial token is third-party and is delivered through an external bootstrap script');
  }
}

function validateOriginTrialScript(filePath, label, token) {
  if (!fs.existsSync(filePath)) {
    error(`${label} is missing`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(token)) {
    error(`${label} does not contain the configured origin-trial token`);
  } else {
    ok(`${label} contains the configured token`);
  }
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

    const token = String(agentic.webmcp.origin_trial_token ?? '').trim();
    if (!token) {
      warn('WebMCP origin-trial token is empty; tool registration will remain inactive in browsers that require the trial');
    } else {
      validateOriginTrialToken(config, token);
      validateOriginTrialScript(STATIC_ORIGIN_TRIAL_SCRIPT, 'sveltekit/static/webmcp-origin-trial.js', token);
      validateOriginTrialScript(BUILD_ORIGIN_TRIAL_SCRIPT, 'sveltekit/build/webmcp-origin-trial.js', token);

      if (!fs.existsSync(BUILD_HOME_PATH)) {
        error('Built homepage is missing while validating WebMCP bootstrap delivery');
      } else {
        const html = fs.readFileSync(BUILD_HOME_PATH, 'utf-8');
        if (!/<script\s+src=["']\/webmcp-origin-trial\.js["'][^>]*><\/script>/i.test(html)) {
          error('Built homepage does not load /webmcp-origin-trial.js before hydration');
        } else {
          ok('Built homepage loads the WebMCP origin-trial bootstrap');
        }
      }
    }
  }
}

console.log(`\n${errors === 0 ? '✅' : '❌'} Agentic validation: ${errors} error(s), ${warnings} warning(s)\n`);
if (errors > 0) process.exit(1);
