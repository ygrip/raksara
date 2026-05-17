// src/routes/blog/post/[...slug]/+page.ts
// Handles nested slugs like "feature/my-post"
import type { PageLoad } from './$types';
import { stripYamlFrontmatter } from '$lib/utils';

type PostNav = { title: string; href: string };

function normalizeBlogPostHref(raw: string): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const noOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const prefixed = noOrigin.startsWith('/') ? noOrigin : `/${noOrigin}`;
  if (prefixed.startsWith('/blog/post/')) return prefixed;
  if (prefixed.startsWith('/blog/')) return `/blog/post/${prefixed.slice('/blog/'.length)}`;
  return prefixed;
}

function routeFromNav(value: unknown): PostNav | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object') return null;
  const obj = item as { title?: unknown; link?: unknown; href?: unknown };
  const href = normalizeBlogPostHref(String(obj.link ?? obj.href ?? ''));
  if (!href) return null;
  return {
    title: String(obj.title ?? '').trim() || 'Untitled',
    href,
  };
}

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const slug = params.slug;
  // Fetch the raw markdown from /content/blog/{slug}.md
  const res = await fetch(`/content/blog/${slug}.md`);
  const raw = res.ok ? await res.text() : null;
  // Strip YAML frontmatter before rendering
  const markdown = stripYamlFrontmatter(raw);

  // Load post metadata to get title/cover etc.
  const postsRes = await fetch('/metadata/posts.json');
  const allPosts: import('$lib/types').Post[] = postsRes.ok ? await postsRes.json() : [];
  const post = allPosts.find((p) => p.slug === slug) ?? null;
  const nextPage = routeFromNav((post as unknown as { next_page?: unknown } | null)?.next_page);
  const previousPage = routeFromNav((post as unknown as { previous_page?: unknown } | null)?.previous_page);
  const dirsRes = await fetch('/metadata/blog-dirs.json');
  const blogDirs = dirsRes.ok ? await dirsRes.json() : {};

  return { slug, markdown, post, allPosts, blogDirs, nextPage, previousPage };
};
