// src/routes/portfolio/[slug]/+page.ts
import type { PageLoad } from './$types';
import { loadPortfolio } from '$lib/metadata';

export const prerender = true;

export const load: PageLoad = async ({ params, fetch }) => {
  const portfolio = await loadPortfolio(fetch).catch(() => []);
  const item = portfolio.find((p) => p.slug === params.slug) ?? null;
  const res = await fetch(`/content/portfolio/${params.slug}.md`);
  const raw = res.ok ? await res.text() : null;
  const markdown = raw ? raw.replace(/^---\s*[\s\S]*?\s*---\s*/, '') : null;
  return { item, markdown };
};
