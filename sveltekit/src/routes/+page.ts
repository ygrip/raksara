// src/routes/+page.ts
import { loadHomeBundle, loadGallery, loadImageManifest, loadPortfolio, loadThoughts } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [bundle, gallery, portfolio, thoughts, imageManifest] = await Promise.all([
    loadHomeBundle(fetch).catch(() => null),
    loadGallery(fetch).catch(() => []),
    loadPortfolio(fetch).catch(() => []),
    loadThoughts(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
  ]);
  // Merge portfolio and thoughts into bundle for the page template
  const mergedBundle = bundle ? { ...bundle, portfolio, thoughts } : null;
  return { bundle: mergedBundle, gallery, imageManifest };
};
