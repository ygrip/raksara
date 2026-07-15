// src/routes/tags/+page.ts
import type { PageLoad } from './$types';
import { loadTags } from '$lib/metadata';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const tags = await loadTags(fetch).catch(() => ({} as Record<string, number>));
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { tags: sorted };
};
