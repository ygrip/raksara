import { loadDocs } from '$lib/metadata';

export const prerender = true;

type DocNav = { href: string; title: string };

function routeFromNav(value: unknown): DocNav | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object') return null;
  const raw = String((item as { link?: unknown; href?: unknown }).link ?? (item as { href?: unknown }).href ?? '');
  if (!raw) return null;
  const href = '/' + raw.replace(/^#\/?/, '').replace(/^\/+/, '');
  const title = String((item as { title?: unknown }).title ?? '').trim() || 'Documentation';
  return { href, title };
}

export const load = async ({ params, fetch }: { params: { slug: string }; fetch: typeof globalThis.fetch }) => {
  const slug = params.slug;
  const docs = await loadDocs(fetch).catch(() => []);
  const doc = docs.find((d) => d.slug === `doc/${slug}`) ?? null;

  const res = await fetch(`/content/pages/doc/${slug}.md`);
  const raw = res.ok ? await res.text() : null;
  const markdown = raw ? raw.replace(/^---[\s\S]*?---\n?/, '') : null;
  const nav = doc as unknown as { next_page?: unknown; previous_page?: unknown } | null;

  return {
    slug,
    doc,
    markdown,
    nextPage: routeFromNav(nav?.next_page),
    previousPage: routeFromNav(nav?.previous_page),
  };
};
