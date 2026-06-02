// src/routes/thoughts/+page.ts
import { loadThoughts } from '$lib/metadata';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const thoughts = await loadThoughts(fetch).catch(() => []);
  return { thoughts };
};
