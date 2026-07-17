const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METADATA_DIR = path.join(ROOT, 'metadata');
const STATIC_DIR = path.join(ROOT, 'sveltekit', 'static');
const CONFIG_PATH = path.join(METADATA_DIR, 'config.json');
const LLMS_PATH = path.join(STATIC_DIR, 'llms.txt');
const STRICT = process.argv.includes('--strict');

function fail(message) {
  if (STRICT) {
    console.error(`  ✗ ${message}`);
    process.exitCode = 1;
    return;
  }
  console.warn(`  ⚠ ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    fail(`Unable to read ${path.relative(ROOT, filePath)}: ${error.message}`);
    return null;
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSiteUrl(value) {
  const text = cleanText(value);
  if (!text) return '';
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return withProtocol.replace(/\/+$/, '');
}

function toAbsoluteUrl(siteUrl, href) {
  const value = cleanText(href);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (!siteUrl) return value;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${siteUrl}${normalizedPath}`;
}

function escapeLabel(value) {
  return cleanText(value)
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\r?\n/g, ' ');
}

function escapeDescription(value) {
  return cleanText(value).replace(/\r?\n/g, ' ');
}

function removeStaleLlmsFile() {
  if (!fs.existsSync(LLMS_PATH)) return;
  fs.unlinkSync(LLMS_PATH);
  console.log('  ✓ Removed disabled llms.txt');
}

function buildLlmsTxt(config) {
  const agentic = config?.agentic;
  const llms = agentic?.llms;

  if (agentic?.enabled !== true || llms?.enabled !== true) {
    removeStaleLlmsFile();
    return null;
  }

  const siteUrl = normalizeSiteUrl(config.site_url || config.url);
  const title = cleanText(llms.title) || cleanText(config.hero_title) || cleanText(config.title) || 'Raksara';
  const summary = cleanText(llms.summary) || cleanText(config.description) || cleanText(config.hero_subtitle);
  const rawDetails = Array.isArray(llms.details) ? llms.details : llms.details ? [llms.details] : [];
  const details = rawDetails.map(cleanText).filter(Boolean);
  const rawSections = Array.isArray(llms.sections) ? llms.sections : [];

  if (!summary) fail('agentic.llms requires a concise summary');
  if (!siteUrl) fail('agentic.llms requires site_url so generated links can be absolute');

  const sections = rawSections
    .map((section, sectionIndex) => {
      const sectionTitle = cleanText(section?.title);
      const links = Array.isArray(section?.links)
        ? section.links
            .map((link, linkIndex) => {
              const label = escapeLabel(link?.label || link?.title);
              const url = toAbsoluteUrl(siteUrl, link?.href || link?.url);
              const description = escapeDescription(link?.description || link?.notes);

              if (!label || !url) {
                fail(`agentic.llms.sections[${sectionIndex}].links[${linkIndex}] requires label and href`);
                return null;
              }

              return { label, url, description };
            })
            .filter(Boolean)
        : [];

      if (!sectionTitle) {
        fail(`agentic.llms.sections[${sectionIndex}] requires title`);
        return null;
      }
      if (links.length === 0) {
        fail(`agentic.llms section "${sectionTitle}" has no valid links`);
        return null;
      }

      return { title: sectionTitle, links };
    })
    .filter(Boolean);

  if (sections.length === 0) {
    fail('agentic.llms requires at least one section with a valid link');
  }

  if (process.exitCode) return null;

  const lines = [`# ${title}`, ''];
  if (summary) lines.push(`> ${summary}`, '');
  for (const detail of details) lines.push(detail, '');

  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    for (const link of section.links) {
      lines.push(`- [${link.label}](${link.url})${link.description ? `: ${link.description}` : ''}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

console.log('\n🤖 Building agentic browsing artifacts...\n');

const config = readJson(CONFIG_PATH);
if (!config) {
  removeStaleLlmsFile();
} else {
  const llmsTxt = buildLlmsTxt(config);
  if (llmsTxt) {
    fs.mkdirSync(STATIC_DIR, { recursive: true });
    fs.writeFileSync(LLMS_PATH, llmsTxt, 'utf-8');
    console.log('  ✓ Generated sveltekit/static/llms.txt');
  }
}

if (process.exitCode) {
  console.error('\n❌ Agentic artifact generation failed.\n');
} else {
  console.log('\n✅ Agentic artifacts ready.\n');
}
