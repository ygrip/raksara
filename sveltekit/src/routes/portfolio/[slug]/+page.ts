// src/routes/portfolio/[slug]/+page.ts
import type { PageLoad } from './$types';
import { loadImageManifest, loadPortfolio } from '$lib/metadata';
import { renderMarkdown } from '$lib/markdown';
import { stripYamlFrontmatter } from '$lib/utils';

export const prerender = true;

function stripLeadingTitle(md: string, title?: string | null): string {
  if (!title) return md;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return md.replace(new RegExp(`^\\s*#\\s+${escaped}\\s*\\n+`, 'i'), '');
}

export const load: PageLoad = async ({ params, fetch }) => {
  const [portfolio, imageManifest] = await Promise.all([
    loadPortfolio(fetch).catch(() => []),
    loadImageManifest(fetch).catch(() => null),
  ]);
  const item = portfolio.find((p) => p.slug === params.slug) ?? null;
  const res = await fetch(`/content/portfolio/${params.slug}.md`);
  const raw = res.ok ? await res.text() : null;
  const markdown = stripYamlFrontmatter(raw);
  const renderedHtml = markdown
    ? await renderMarkdown(stripLeadingTitle(markdown, item?.title), {
        imageManifest: imageManifest ?? undefined,
      })
    : '';
  return { item, markdown, renderedHtml, imageManifest };
};
