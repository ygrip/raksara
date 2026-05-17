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
} from './types';

const BASE = '/metadata';

async function fetchJSON<T>(fetch: typeof globalThis.fetch, path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
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
