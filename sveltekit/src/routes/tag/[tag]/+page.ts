// src/routes/tag/[tag]/+page.ts
import type { PageLoad } from './$types';
import { loadGallery, loadImageManifest, loadPosts, loadPortfolio, loadThoughts } from '$lib/metadata';

export const prerender = true;

function newestFirst<T extends { date?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

export const load: PageLoad = async ({ params, fetch }) => {
  const tag = params.tag;
  const [posts, portfolio, thoughts, gallery, imageManifest] = await Promise.all([
    loadPosts(fetch).catch(() => [] as Awaited<ReturnType<typeof loadPosts>>),
    loadPortfolio(fetch).catch(() => [] as Awaited<ReturnType<typeof loadPortfolio>>),
    loadThoughts(fetch).catch(() => [] as Awaited<ReturnType<typeof loadThoughts>>),
    loadGallery(fetch).catch(() => [] as Awaited<ReturnType<typeof loadGallery>>),
    loadImageManifest(fetch).catch(() => null),
  ]);

  return {
    tag,
    posts: newestFirst(posts.filter((p) => p.tags?.includes(tag))),
    portfolio: newestFirst(portfolio.filter((p) => p.tags?.includes(tag))),
    thoughts: newestFirst(thoughts.filter((t) => t.tags?.includes(tag))),
    gallery: newestFirst(gallery.filter((g) => g.tags?.includes(tag))),
    imageManifest,
  };
};
