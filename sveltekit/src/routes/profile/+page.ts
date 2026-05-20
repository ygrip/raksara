// src/routes/profile/+page.ts
import type { PageLoad } from './$types';
import { loadPages, loadProfilePrerender } from '$lib/metadata';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const pages = await loadPages(fetch).catch(() => []);
  const profile = pages.find((p) => p.slug === 'profile') ?? null;
  
  // Try to load profile prerender data
  const prerenderData = await loadProfilePrerender(fetch).catch(() => null);
  
  return { 
    profile, 
    markdown: null, // Will use prerendered HTML instead
    prerenderHtml: prerenderData?.html || null
  };
};
