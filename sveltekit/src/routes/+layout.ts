// src/routes/+layout.ts
// Root layout data loader: fetches config once for the whole app tree.

import { loadConfig } from '$lib/metadata';
import type { LayoutLoad } from './$types';

export const prerender = true;

export const load: LayoutLoad = async ({ fetch }) => {
  const config = await loadConfig(fetch).catch(() => null);
  return { config };
};
