// src/routes/doc/[...path]/+page.ts
// Handles doc pages: /doc/chapters, /doc/chart, etc.
import type { PageLoad } from './$types';
import { loadPages, loadDocs } from '$lib/metadata';

function routeFromNav(value: unknown): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object') return null;
  const raw = String((item as { link?: unknown; href?: unknown }).link ?? (item as { href?: unknown }).href ?? '');
  if (!raw) return null;
  return raw.replace(/^#/, '').replace(/^\/+/, '');
}

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const slug = `doc/${params.path.replace(/\/+$/, '')}`;
  const pages = await loadPages(fetch).catch(() => []);
  const page = pages.find((p) => p.slug === slug) ?? null;

  const res = await fetch(`/content/pages/${slug}.md`);
  const markdown = res.ok ? await res.text() : null;

  const pageNav = page as unknown as { next_page?: unknown; previous_page?: unknown } | null;
  const nextPage = routeFromNav(pageNav?.next_page);
  const previousPage = routeFromNav(pageNav?.previous_page);

  const docs = await loadDocs(fetch).catch(() => []);

  return { page, markdown, slug, nextPage, previousPage, docs };
};
