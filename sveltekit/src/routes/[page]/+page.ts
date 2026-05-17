// src/routes/[page]/+page.ts
// Handles generic pages: /about, /documentation, etc.
// Also catches /doc/{slug} style paths via the separate doc route.
import type { PageLoad } from './$types';
import { loadPages, loadDocs } from '$lib/metadata';
import { stripYamlFrontmatter } from '$lib/utils';

function routeFromNav(value: unknown): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object') return null;
  const raw = String((item as { link?: unknown; href?: unknown }).link ?? (item as { href?: unknown }).href ?? '');
  if (!raw) return null;
  return raw.replace(/^#/, '').replace(/^\/+/, '');
}

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const slug = params.page;

  // Guard: skip markdown fetch for file asset paths (e.g. /favicon.ico, /robots.txt)
  if (/\.[^/]{1,6}$/.test(slug) && !slug.endsWith('.html')) {
    return { page: null, markdown: null, slug, nextPage: null, previousPage: null, docs: null };
  }

  const pages = await loadPages(fetch).catch(() => []);
  const page = pages.find((p) => p.slug === slug) ?? null;
  const docs = await loadDocs(fetch).catch(() => []);
  // Try pages/slug.md
  const res = await fetch(`/content/pages/${slug}.md`);
  const markdown = res.ok ? await res.text() : null;

  const pageNav = page as unknown as { next_page?: unknown; previous_page?: unknown } | null;
  const nextPage = routeFromNav(pageNav?.next_page);
  const previousPage = routeFromNav(pageNav?.previous_page);

  // Strip YAML frontmatter before passing to the renderer
  const strippedMarkdown = stripYamlFrontmatter(markdown);

  const componentEntries = [...docs, ...pages];

  return { page, markdown: strippedMarkdown, slug, nextPage, previousPage, docs, componentEntries };
};
