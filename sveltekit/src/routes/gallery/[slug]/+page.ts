import { loadGallery, loadImageManifest } from '$lib/metadata';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ fetch, params }) => {
  const [gallery, imageManifest] = await Promise.all([
    loadGallery(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
  ]);
  return { gallery, activeSlug: params.slug, imageManifest };
};
