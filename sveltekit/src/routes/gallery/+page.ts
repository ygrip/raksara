// src/routes/gallery/+page.ts
import { loadGallery, loadImageManifest } from '$lib/metadata';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const [gallery, imageManifest] = await Promise.all([
    loadGallery(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
  ]);
  return { gallery, imageManifest };
};
