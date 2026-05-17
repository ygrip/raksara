// src/routes/category/[cat]/+page.ts
import type { PageLoad } from './$types';
import { loadGallery, loadImageManifest, loadPosts, loadPortfolio } from '$lib/metadata';

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const cat = params.cat;
  const [posts, portfolio, gallery, imageManifest] = await Promise.all([
    loadPosts(fetch).catch(() => []),
    loadPortfolio(fetch).catch(() => []),
    loadGallery(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
  ]);
  const filteredPosts = posts.filter((p) => p.category === cat);
  const filteredPortfolio = portfolio.filter((p) => p.category === cat);
  const filteredGallery = gallery.filter((g) => g.category === cat);
  return { cat, posts: filteredPosts, portfolio: filteredPortfolio, gallery: filteredGallery, imageManifest };
};
