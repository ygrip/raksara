// src/lib/metadata.ts
// Metadata fetch helpers for SvelteKit routes.
// Routes call these from +page.ts / +layout.ts load functions.
// Works both in SSG (build time) and client-side navigation.

import type {
  Post,
  PortfolioItem,
  GalleryItem,
  Thought,
  Page,
  DocEntry,
  SiteConfig,
  BlogDirs,
  ImageManifest,
  HomeBundle,
  HomePageConfig,
  TaxonomyKind,
  TaxonomyIndex,
  TaxonomyArchivePage,
} from './types';

const BASE = '/metadata';

// __BUILD_TS__ is injected by Vite at build time (see vite.config.ts).
// Appending it as a query param busts the browser HTTP cache after each deploy,
// so new posts and metadata are always fetched fresh without a hard reload.
declare const __BUILD_TS__: string;
const _v = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';

/**
 * The build-time cache-bust token injected by Vite.
 * Use this to version static asset URLs (images, etc.) after each deploy.
 */
export const buildVersion: string = _v;

async function fetchJSON<T>(fetch: typeof globalThis.fetch, path: string, signal?: AbortSignal): Promise<T> {
  const url = _v ? `${BASE}/${path}?v=${_v}` : `${BASE}/${path}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadConfig(fetch: typeof globalThis.fetch): Promise<SiteConfig> {
  return fetchJSON<SiteConfig>(fetch, 'config.json');
}

export async function loadHomeBundle(
  fetch: typeof globalThis.fetch
): Promise<HomeBundle> {
  return fetchJSON<HomeBundle>(fetch, 'home-bundle.json');
}

export async function loadPosts(fetch: typeof globalThis.fetch): Promise<Post[]> {
  return fetchJSON<Post[]>(fetch, 'posts.json');
}

export async function loadPortfolio(
  fetch: typeof globalThis.fetch
): Promise<PortfolioItem[]> {
  return fetchJSON<PortfolioItem[]>(fetch, 'portfolio.json');
}

export async function loadGallery(
  fetch: typeof globalThis.fetch
): Promise<GalleryItem[]> {
  return fetchJSON<GalleryItem[]>(fetch, 'gallery.json');
}

export async function loadThoughts(
  fetch: typeof globalThis.fetch
): Promise<Thought[]> {
  return fetchJSON<Thought[]>(fetch, 'thoughts.json');
}

export async function loadPages(fetch: typeof globalThis.fetch): Promise<Page[]> {
  return fetchJSON<Page[]>(fetch, 'pages.json');
}

export async function loadDocs(fetch: typeof globalThis.fetch): Promise<DocEntry[]> {
  return fetchJSON<DocEntry[]>(fetch, 'docs.json');
}

export async function loadBlogDirs(
  fetch: typeof globalThis.fetch
): Promise<BlogDirs> {
  return fetchJSON<BlogDirs>(fetch, 'blog-dirs.json');
}

export async function loadImageManifest(
  fetch: typeof globalThis.fetch
): Promise<ImageManifest> {
  return fetchJSON<ImageManifest>(fetch, 'image-manifest.json');
}

export async function loadTags(
  fetch: typeof globalThis.fetch
): Promise<Record<string, number>> {
  return fetchJSON<Record<string, number>>(fetch, 'tags.json');
}

export async function loadCategories(
  fetch: typeof globalThis.fetch
): Promise<Record<string, number>> {
  return fetchJSON<Record<string, number>>(fetch, 'categories.json');
}

export async function loadTaxonomyIndex(fetch: typeof globalThis.fetch, signal?: AbortSignal): Promise<TaxonomyIndex> {
  const index = await fetchJSON<TaxonomyIndex>(fetch, 'taxonomy/index.json', signal);
  if (!index || index.version !== 1 || !Number.isSafeInteger(index.pageSize) || index.pageSize < 1
    || !index.tags || typeof index.tags !== 'object' || Array.isArray(index.tags)
    || !index.categories || typeof index.categories !== 'object' || Array.isArray(index.categories)) {
    throw new Error('Invalid taxonomy registry; reload the page to update the site.');
  }
  return index;
}

export async function loadTaxonomyPage(
  fetch: typeof globalThis.fetch,
  kind: TaxonomyKind,
  id: string,
  page = 1,
  signal?: AbortSignal
): Promise<TaxonomyArchivePage> {
  if (!['tag', 'category'].includes(kind) || !/^[a-f0-9]{32}$/.test(id) || !Number.isSafeInteger(page) || page < 1) {
    throw new Error('Invalid taxonomy page request');
  }
  const result = await fetchJSON<TaxonomyArchivePage>(fetch, `taxonomy/${kind}/${id}/${page}.json`, signal);
  if (!result || result.kind !== kind || result.page !== page || typeof result.term !== 'string'
    || !Number.isSafeInteger(result.total) || result.total < 1
    || !Number.isSafeInteger(result.pageSize) || result.pageSize < 1
    || result.pages !== Math.ceil(result.total / result.pageSize) || page > result.pages
    || !Array.isArray(result.posts) || !Array.isArray(result.portfolio)
    || !Array.isArray(result.thoughts) || !Array.isArray(result.gallery)
    || !result.imageManifest || typeof result.imageManifest !== 'object' || Array.isArray(result.imageManifest)
    || result.posts.length + result.portfolio.length + result.thoughts.length + result.gallery.length
      !== Math.min(result.pageSize, result.total - (page - 1) * result.pageSize)) {
    throw new Error('Invalid taxonomy results; reload the page to update the site.');
  }
  return result;
}

export async function loadSearchIndex(
  fetch: typeof globalThis.fetch
): Promise<unknown> {
  return fetchJSON<unknown>(fetch, 'search-index.json');
}

export async function loadProfilePrerender(
  fetch: typeof globalThis.fetch
): Promise<{ html?: string } | null> {
  return fetchJSON<{ html?: string }>(fetch, 'profile-prerender.json');
}

export async function loadHomePageConfig(fetch: typeof globalThis.fetch): Promise<HomePageConfig | null> {
  return fetchJSON<HomePageConfig>(fetch, 'homepage.json').catch(() => null);
}

/** Returns the versioned URL for a metadata file — useful for client-side fetches
 *  that can't use SvelteKit's `fetch` wrapper (e.g. components, workers).
 *  Falls back to bare URL in dev/SSR where __BUILD_TS__ is unavailable.
 */
export function metadataUrl(path: string): string {
  const v = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';
  return v ? `/metadata/${path}?v=${v}` : `/metadata/${path}`;
}
