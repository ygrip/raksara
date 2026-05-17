// src/routes/categories/+page.ts
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/metadata/categories.json');
  const cats: Record<string, number> = res.ok ? await res.json() : {};
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { categories: sorted };
};
