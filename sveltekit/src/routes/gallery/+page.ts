// src/routes/gallery/+page.ts
import { loadGallery } from '$lib/metadata';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ fetch }) => {
  const gallery = await loadGallery(fetch).catch(() => []);
  return { gallery };
};
