// src/routes/+page.ts
import { loadHomeBundle, loadGallery, loadImageManifest, loadPortfolio, loadThoughts, loadHomePageConfig, loadPages } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [bundle, gallery, portfolio, thoughts, imageManifest, homePageConfig, pages] = await Promise.all([
    loadHomeBundle(fetch).catch(() => null),
    loadGallery(fetch).catch(() => []),
    loadPortfolio(fetch).catch(() => []),
    loadThoughts(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
    loadHomePageConfig(fetch).catch(() => null),
    loadPages(fetch).catch(() => []),
  ]);
  const mergedBundle = bundle ? { ...bundle, portfolio, thoughts } : null;
  // The profile page supplies the author's full name and social links for Person schema.
  const profile = pages.find((entry) => entry.slug === 'profile') ?? null;
  return { bundle: mergedBundle, gallery, imageManifest, homePageConfig, profile };
};
