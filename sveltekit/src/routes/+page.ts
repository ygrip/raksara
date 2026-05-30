// src/routes/+page.ts
import { loadHomeBundle, loadGallery, loadImageManifest, loadPortfolio, loadThoughts, loadHomePageConfig } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [bundle, gallery, portfolio, thoughts, imageManifest, homePageConfig] = await Promise.all([
    loadHomeBundle(fetch).catch(() => null),
    loadGallery(fetch).catch(() => []),
    loadPortfolio(fetch).catch(() => []),
    loadThoughts(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
    loadHomePageConfig(fetch).catch(() => null),
  ]);
  const mergedBundle = bundle ? { ...bundle, portfolio, thoughts } : null;
  return { bundle: mergedBundle, gallery, imageManifest, homePageConfig };
};
