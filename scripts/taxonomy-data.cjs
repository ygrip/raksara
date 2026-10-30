const crypto = require('node:crypto');

const PAGE_SIZE = 30;
const FIELDS = {
  posts: ['title', 'slug', 'path', 'section', 'date', 'summary', 'category', 'tags', 'type'],
  portfolio: ['title', 'slug', 'path', 'section', 'date', 'summary', 'category', 'tags'],
  thoughts: ['title', 'slug', 'path', 'section', 'date', 'body', 'tags'],
  gallery: ['title', 'slug', 'path', 'section', 'date', 'caption', 'image', 'images', 'category', 'tags'],
};

/** Build archives once per content association, not by rescanning all items per term. */
function buildTaxonomyData({ posts = [], portfolio = [], thoughts = [], gallery = [], imageManifest = {}, config = {} }) {
  const groups = { tag: new Map(), category: new Map() };
  for (const [collection, items] of Object.entries({ posts, portfolio, thoughts, gallery })) {
    for (const item of items) {
      if (item.tags !== undefined && !Array.isArray(item.tags)) throw new Error(`Invalid tags array on ${item.slug}`);
      const compact = Object.fromEntries(FIELDS[collection]
        .filter((field) => item[field] !== undefined)
        .map((field) => [field, item[field]]));
      const terms = { tag: [...new Set(item.tags || [])], category: collection === 'thoughts' ? [] : [item.category].filter(Boolean) };
      for (const [kind, names] of Object.entries(terms)) {
        for (const term of names) {
          if (typeof term !== 'string' || !term.trim()) throw new Error(`Invalid ${kind} term on ${item.slug}`);
          if (!groups[kind].has(term)) groups[kind].set(term, []);
          groups[kind].get(term).push({ collection, item: compact });
        }
      }
    }
  }

  const index = { version: 1, pageSize: PAGE_SIZE, tags: {}, categories: {} };
  const pages = new Map();
  for (const [kind, terms] of Object.entries(groups)) {
    const entries = [];
    for (const [term, items] of terms) {
      items.sort((a, b) => String(b.item.date || '').localeCompare(String(a.item.date || ''))
        || String(a.item.slug).localeCompare(String(b.item.slug)) || a.collection.localeCompare(b.collection));
      const id = crypto.createHash('sha256').update(`${kind}\0${term}`).digest('hex').slice(0, 32);
      const total = items.length;
      const pageCount = Math.ceil(total / PAGE_SIZE);
      entries.push([term, { id, total, pages: pageCount }]);
      for (let page = 1; page <= pageCount; page++) {
        const result = { kind, term, total, page, pageSize: PAGE_SIZE, pages: pageCount,
          posts: [], portfolio: [], thoughts: [], gallery: [], imageManifest: {} };
        for (const { collection, item } of items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
          result[collection].push(item);
          const sources = [item.image, ...(item.images || []).map((image) => image.src)].filter(Boolean);
          for (const source of sources) {
            let normalized = source.trim().replace(/^\/+/, '').replace(/[?#].*$/, '').replace(/^content\/content\//, 'content/');
            if (!normalized.startsWith('content/') && /^(assets|blog|gallery|pages|portfolio|thoughts)\//.test(normalized)) {
              normalized = `content/${normalized}`;
            }
            const key = Object.hasOwn(imageManifest, source) ? source : normalized;
            if (Object.hasOwn(imageManifest, key)) Object.defineProperty(result.imageManifest, key, {
              value: imageManifest[key], enumerable: true, configurable: true, writable: true,
            });
          }
        }
        pages.set(`${kind}/${id}/${page}.json`, result);
      }
    }
    index[kind === 'tag' ? 'tags' : 'categories'] = Object.fromEntries(entries);
  }
  validateHighlightedTags(config, index);
  return { index, pages };
}

function validateHighlightedTags(config, index) {
  if (config.taxonomy !== undefined && (!config.taxonomy || typeof config.taxonomy !== 'object' || Array.isArray(config.taxonomy))) {
    throw new Error('taxonomy must be an object');
  }
  const highlighted = config.taxonomy?.highlighted_tags === undefined ? [] : config.taxonomy.highlighted_tags;
  if (!Array.isArray(highlighted) || highlighted.some((term) => typeof term !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(term))) {
    throw new Error('taxonomy.highlighted_tags must be an array of safe tag slugs (letters, digits, hyphen, underscore)');
  }
  if (new Set(highlighted).size !== highlighted.length) throw new Error('taxonomy.highlighted_tags contains duplicates');
  for (const term of highlighted) {
    if (!Object.hasOwn(index.tags, term)) throw new Error(`Highlighted tag has no visible content: ${term}`);
    const topic = config.topics?.[term];
    if (!topic?.title?.trim() || !(topic.intro || topic.description)?.trim()) {
      throw new Error(`Highlighted tag needs topics.${term}.title and intro or description`);
    }
  }
  const categories = config.taxonomy?.highlighted_categories === undefined ? [] : config.taxonomy.highlighted_categories;
  if (!Array.isArray(categories) || categories.some((term) => typeof term !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(term))) {
    throw new Error('taxonomy.highlighted_categories must be an array of safe category slugs');
  }
  if (new Set(categories).size !== categories.length) throw new Error('taxonomy.highlighted_categories contains duplicates');
  for (const term of categories) {
    if (!Object.hasOwn(index.categories, term)) throw new Error(`Highlighted category has no visible content: ${term}`);
    const topic = config.category_topics?.[term];
    if (!topic?.title?.trim() || !(topic.intro || topic.description)?.trim()) {
      throw new Error(`Highlighted category needs category_topics.${term}.title and intro or description`);
    }
  }
}

module.exports = { PAGE_SIZE, buildTaxonomyData, validateHighlightedTags };
