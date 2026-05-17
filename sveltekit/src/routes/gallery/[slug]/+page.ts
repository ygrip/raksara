import { loadGallery } from '$lib/metadata';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ fetch, params }) => {
  const gallery = await loadGallery(fetch).catch(() => []);
  return { gallery, activeSlug: params.slug };
};
