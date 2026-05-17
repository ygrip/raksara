// src/routes/portfolio/+page.ts
import { loadPortfolio } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const portfolio = await loadPortfolio(fetch).catch(() => []);
  return { portfolio };
};
