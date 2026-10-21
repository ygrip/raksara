/**
 * Release gate: private/draft content must never reach public HTML, raw
 * Markdown, metadata, sitemap, or feeds. Runs after the static site build.
 */
const fs = require('node:fs');
const path = require('node:path');
const fg = require('fast-glob');
const yaml = require('js-yaml');
const { isPublished } = require('./publication-policy.cjs');

const root = path.join(__dirname, '..');
const contentDir = path.join(root, 'content');
const staticDir = path.join(root, 'sveltekit/static');
const distDir = path.join(root, 'sveltekit/build');
if (!fs.existsSync(contentDir) || !fs.existsSync(distDir)) {
  throw new Error('Publication audit requires the content checkout and built static site');
}
const configFile = path.join(contentDir, 'raksara.yml');
const config = fs.existsSync(configFile) ? yaml.load(fs.readFileSync(configFile, 'utf8')) : {};
const metaRoot = path.join(staticDir, 'metadata');
const output = [
  fs.readFileSync(path.join(staticDir, 'sitemap.xml'), 'utf8'),
  fs.readFileSync(path.join(staticDir, 'feed.xml'), 'utf8'),
  fs.readFileSync(path.join(staticDir, 'atom.xml'), 'utf8'),
];
const arrays = ['posts.json', 'portfolio.json', 'pages.json', 'docs.json', 'gallery.json', 'thoughts.json']
  .flatMap(name => JSON.parse(fs.readFileSync(path.join(metaRoot, name), 'utf8')));
const indexed = new Set(arrays.map(item => item.path));
const search = fs.readFileSync(path.join(metaRoot, 'search-index.json'), 'utf8');
let checked = 0;
let excluded = 0;

for (const relative of fg.sync('**/*.md', { cwd: contentDir, onlyFiles: true })) {
  const raw = fs.readFileSync(path.join(contentDir, relative), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? '';
  const fields = {};
  // The publication keys are intentionally top-level scalar fields. A loose
  // scan tolerates unrelated legacy Markdown frontmatter syntax.
  for (const key of ['status', 'visibility', 'draft', 'published']) {
    const value = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'))?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (value !== undefined) fields[key] = value === 'true' ? true : value === 'false' ? false : value;
  }
  checked++;
  if (isPublished(fields, config)) continue;
  excluded++;
  const sourcePath = `content/${relative}`;
  if (indexed.has(sourcePath)) throw new Error(`Unpublished metadata item: ${sourcePath}`);
  if (search.includes(sourcePath.replaceAll('\\', '/'))) throw new Error(`Unpublished search entry: ${sourcePath}`);
  for (const dir of [staticDir, distDir]) {
    for (const prefix of ['content', 'content/content']) {
      if (fs.existsSync(path.join(dir, prefix, relative))) {
        throw new Error(`Unpublished raw source shipped: ${path.join(dir, prefix, relative)}`);
      }
    }
  }
  const section = relative.split('/')[0];
  const slug = section === 'blog' ? relative.slice('blog/'.length, -3) : path.basename(relative, '.md');
  const route = section === 'blog' ? `/blog/post/${slug}/` : section === 'portfolio' ? `/portfolio/${slug}/` : null;
  if (route && output.some(xml => xml.includes(`<loc>${new URL(route, 'https://example.invalid').pathname}`))) {
    throw new Error(`Unpublished route in feed or sitemap: ${route}`);
  }
  if (route && output.some(xml => xml.includes(route))) {
    throw new Error(`Unpublished route in feed or sitemap: ${route}`);
  }
}
console.log(`Publication audit passed: ${checked} content files, ${excluded} excluded from public build`);
