const fg = require('fast-glob');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const METADATA_DIR = path.join(__dirname, '..', 'metadata');
const WEB_DIR = path.join(__dirname, '..', 'web');

fs.mkdirSync(METADATA_DIR, { recursive: true });

function stripMarkdown(md) {
  return md
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\|.*\|/g, '')
    .replace(/[-=]{3,}/g, '')
    .replace(/>\s+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

async function buildMetadata() {
  console.log('Building metadata...\n');

  const files = await fg('**/*.md', { cwd: CONTENT_DIR });
  const posts = [];
  const portfolioItems = [];
  const galleryItems = [];
  const thoughts = [];
  const pages = [];
  const tags = {};
  const categories = {};
  const titleMap = {};

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(raw);
    const section = file.split(path.sep)[0];
    const slug = section === 'blog'
      ? file.replace(/^blog\//, '').replace(/\.md$/, '')
      : path.basename(file, '.md');

    titleMap[`content/${file}`] = data.title || slug;

    const entry = {
      title: data.title || slug,
      slug,
      path: `content/${file}`,
      section,
      ...data,
    };

    if (section === 'blog') {
      entry.date = data.date ? new Date(data.date).toISOString().split('T')[0] : '1970-01-01';
      entry.summary = data.summary || stripMarkdown(content).substring(0, 160) + '...';
      const dir = path.dirname(slug);
      entry.dir = dir === '.' ? '' : dir;
      posts.push(entry);
    } else if (section === 'portfolio') {
      entry.summary = data.summary || stripMarkdown(content).substring(0, 160) + '...';
      portfolioItems.push(entry);
    } else if (section === 'gallery') {
      entry.date = data.date ? new Date(data.date).toISOString().split('T')[0] : '1970-01-01';
      entry.image = data.image || '';
      entry.caption = data.caption || '';
      entry.description = stripMarkdown(content) || '';
      galleryItems.push(entry);
    } else if (section === 'thoughts') {
      entry.date = data.date ? new Date(data.date).toISOString().split('T')[0] : '1970-01-01';
      entry.body = stripMarkdown(content);
      thoughts.push(entry);
    } else if (section === 'pages') {
      pages.push(entry);
    }

    if (data.tags && Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }
    if (data.category) {
      categories[data.category] = (categories[data.category] || 0) + 1;
    }
  }

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  galleryItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  thoughts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const blogDirs = buildBlogDirs(posts);

  const searchDocs = [];
  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(raw);
    const section = file.split(path.sep)[0];
    const searchSlug = section === 'blog'
      ? file.replace(/^blog\//, '').replace(/\.md$/, '')
      : path.basename(file, '.md');
    searchDocs.push({
      id: `content/${file}`,
      title: data.title || searchSlug,
      tags: (data.tags || []).join(' '),
      category: data.category || '',
      body: stripMarkdown(content).substring(0, 1000),
      section,
      slug: searchSlug,
    });
  }

  const miniSearch = new MiniSearch({
    fields: ['title', 'tags', 'category', 'body'],
    storeFields: ['title', 'section', 'slug', 'category'],
    searchOptions: {
      boost: { title: 3, tags: 2, category: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  miniSearch.addAll(searchDocs);
  const searchIndex = JSON.parse(JSON.stringify(miniSearch));

  write('blog-dirs.json', blogDirs);
  write('posts.json', posts);
  write('portfolio.json', portfolioItems);
  write('gallery.json', galleryItems);
  write('thoughts.json', thoughts);
  write('pages.json', pages);
  write('tags.json', tags);
  write('categories.json', categories);
  write('search-index.json', searchIndex);

  const configPath = path.join(CONTENT_DIR, 'raksara.yml');
  let siteConfig = { color: 'purple' };
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (m) siteConfig[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  write('config.json', siteConfig);

  copyMetadataToWeb();

  console.log(`  Posts:      ${posts.length}`);
  console.log(`  Portfolio:  ${portfolioItems.length}`);
  console.log(`  Gallery:    ${galleryItems.length}`);
  console.log(`  Thoughts:   ${thoughts.length}`);
  console.log(`  Pages:      ${pages.length}`);
  console.log(`  Tags:       ${Object.keys(tags).length}`);
  console.log(`  Categories: ${Object.keys(categories).length}`);
  console.log('\nMetadata build complete.');
}

function buildBlogDirs(posts) {
  const dirs = {};
  const allDirPaths = new Set(['']);
  for (const p of posts) {
    const d = p.dir || '';
    allDirPaths.add(d);
    const parts = d.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      allDirPaths.add(parts.slice(0, i).join('/'));
    }
  }
  for (const d of allDirPaths) {
    const childDirs = new Set();
    const childPosts = [];
    for (const p of posts) {
      const pd = p.dir || '';
      if (pd === d) {
        childPosts.push(p.slug);
      } else if (d === '' ? !pd.includes('/') && pd !== '' : pd.startsWith(d + '/') && !pd.slice(d.length + 1).includes('/')) {
        childDirs.add(d === '' ? pd : pd.slice(d.length + 1));
      }
    }
    dirs[d] = { subdirs: [...childDirs].sort(), posts: childPosts };
  }
  return dirs;
}

function write(filename, data) {
  const filepath = path.join(METADATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${filename}`);
}

function copyMetadataToWeb() {
  const webMetaDir = path.join(WEB_DIR, 'metadata');
  fs.mkdirSync(webMetaDir, { recursive: true });
  const metaFiles = fs.readdirSync(METADATA_DIR);
  for (const f of metaFiles) {
    fs.copyFileSync(path.join(METADATA_DIR, f), path.join(webMetaDir, f));
  }

  const contentWebDir = path.join(WEB_DIR, 'content');
  copyDirRecursive(CONTENT_DIR, contentWebDir);
  console.log('  ✓ Copied metadata and content to web/');
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

buildMetadata().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
