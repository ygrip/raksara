// src/routes/categories/+page.ts
import type { PageLoad } from './$types';
import { loadCategories } from '$lib/metadata';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const cats = await loadCategories(fetch).catch(() => ({} as Record<string, number>));
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { categories: sorted };
};
