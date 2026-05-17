// src/routes/tag/[tag]/+page.ts
import type { PageLoad } from './$types';
import { loadGallery, loadImageManifest, loadPosts, loadPortfolio, loadThoughts } from '$lib/metadata';

export const prerender = false;

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
    posts:     posts.filter((p) => p.tags?.includes(tag)),
    portfolio: portfolio.filter((p) => p.tags?.includes(tag)),
    thoughts:  thoughts.filter((t) => t.tags?.includes(tag)),
    gallery:   gallery.filter((g) => g.tags?.includes(tag)),
    imageManifest,
  };
};
