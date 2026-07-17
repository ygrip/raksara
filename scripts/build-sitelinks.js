const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METADATA_DIR = path.join(ROOT, 'metadata');
const STATIC_METADATA_DIR = path.join(ROOT, 'sveltekit', 'static', 'metadata');
const CONFIG_PATH = path.join(METADATA_DIR, 'config.json');
const HOMEPAGE_PATH = path.join(STATIC_METADATA_DIR, 'homepage.json');
const ROUTES_PATH = path.join(STATIC_METADATA_DIR, 'prerender-routes.json');
const SITELINKS_PATH = path.join(STATIC_METADATA_DIR, 'sitelinks.json');
const SECTION_ID = 'primary-sitelinks';

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(ROOT, filePath)}: ${error.message}`);
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

function normalizeRoute(value) {
  const text = cleanText(value);
  if (!text || text === '/') return '/';
  const pathname = new URL(text, 'https://raksara.invalid').pathname;
  return `/${decodeURIComponent(pathname).replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function removeInjectedSection(homepage) {
  const sections = Array.isArray(homepage?.sections) ? homepage.sections : [];
  return {
    ...homepage,
    sections: sections.filter((section) => section?.id !== SECTION_ID),
  };
}

function validateAndNormalizeLinks(rawLinks, siteUrl, routeSet) {
  if (!Array.isArray(rawLinks)) {
    throw new Error('seo.sitelinks.links must be an array');
  }
  if (rawLinks.length < 2 || rawLinks.length > 10) {
    throw new Error('seo.sitelinks.links must contain between 2 and 10 links');
  }

  const seenLabels = new Set();
  const seenRoutes = new Set();

  return rawLinks.map((link, index) => {
    const label = cleanText(link?.label || link?.title);
    const href = cleanText(link?.href || link?.url);
    const description = cleanText(link?.description);

    if (!label) throw new Error(`seo.sitelinks.links[${index}] requires label`);
    if (!href) throw new Error(`seo.sitelinks.links[${index}] requires href`);
    if (!description) throw new Error(`seo.sitelinks.links[${index}] requires a concise description`);

    const target = new URL(href, `${siteUrl}/`);
    const siteOrigin = new URL(`${siteUrl}/`).origin;
    if (target.origin !== siteOrigin) {
      throw new Error(`seo.sitelinks link "${label}" must remain on the configured site origin`);
    }

    const route = normalizeRoute(target.pathname);
    if (!routeSet.has(route)) {
      throw new Error(`seo.sitelinks link "${label}" points to a route that is not prerendered: ${href}`);
    }

    const labelKey = label.toLocaleLowerCase();
    if (seenLabels.has(labelKey)) {
      throw new Error(`seo.sitelinks contains duplicate label: ${label}`);
    }
    if (seenRoutes.has(route)) {
      throw new Error(`seo.sitelinks contains duplicate target: ${href}`);
    }
    seenLabels.add(labelKey);
    seenRoutes.add(route);

    const normalizedHref = route === '/' ? '/' : `${route}/`;
    return { label, href: normalizedHref, description };
  });
}

console.log('\n🔗 Building sitelink candidates...\n');

try {
  const config = readJson(CONFIG_PATH);
  const homepage = fs.existsSync(HOMEPAGE_PATH)
    ? readJson(HOMEPAGE_PATH)
    : { sections: [] };
  const cleanHomepage = removeInjectedSection(homepage);
  const sitelinks = config?.seo?.sitelinks;

  if (sitelinks?.enabled !== true) {
    fs.writeFileSync(HOMEPAGE_PATH, `${JSON.stringify(cleanHomepage, null, 2)}\n`);
    if (fs.existsSync(SITELINKS_PATH)) fs.unlinkSync(SITELINKS_PATH);
    console.log('  ✓ Sitelink candidates disabled; removed generated section');
    process.exit(0);
  }

  const siteUrl = normalizeSiteUrl(config.site_url || config.url);
  if (!siteUrl) throw new Error('seo.sitelinks requires site_url');

  const routes = readJson(ROUTES_PATH);
  if (!Array.isArray(routes)) throw new Error('prerender-routes.json must contain an array');
  const routeSet = new Set(routes.map(normalizeRoute));
  const links = validateAndNormalizeLinks(sitelinks.links, siteUrl, routeSet);

  const title = cleanText(sitelinks.title) || 'Explore';
  const description = cleanText(sitelinks.description);
  const generatedSection = {
    type: 'links',
    id: SECTION_ID,
    title,
    enabled: true,
    ...(description ? { description } : {}),
    items: links,
  };

  const sections = Array.isArray(cleanHomepage.sections) ? cleanHomepage.sections : [];
  const generatedHomepage = {
    ...cleanHomepage,
    sections: [generatedSection, ...sections],
  };

  fs.writeFileSync(HOMEPAGE_PATH, `${JSON.stringify(generatedHomepage, null, 2)}\n`);
  fs.writeFileSync(
    SITELINKS_PATH,
    `${JSON.stringify({
      siteName: cleanText(config.seo?.site_name) || cleanText(config.hero_title) || cleanText(config.title),
      alternateNames: Array.isArray(config.seo?.alternate_names)
        ? config.seo.alternate_names.map(cleanText).filter(Boolean)
        : [],
      title,
      description,
      links,
    }, null, 2)}\n`,
  );

  console.log(`  ✓ Generated homepage sitelink section with ${links.length} candidates`);
  console.log('  ✓ Generated sveltekit/static/metadata/sitelinks.json');
} catch (error) {
  console.error(`  ✗ ${error.message}`);
  process.exit(1);
}
