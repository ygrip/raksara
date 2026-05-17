// src/routes/tags/+page.ts
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/metadata/tags.json');
  const tags: Record<string, number> = res.ok ? await res.json() : {};
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { tags: sorted };
};
