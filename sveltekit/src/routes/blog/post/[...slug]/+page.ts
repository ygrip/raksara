// src/routes/blog/post/[...slug]/+page.ts
// Handles nested slugs like "feature/my-post"
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const slug = params.slug;
  // Fetch the raw markdown from /content/blog/{slug}.md
  const res = await fetch(`/content/blog/${slug}.md`);
  const raw = res.ok ? await res.text() : null;
  // Strip YAML frontmatter before rendering
  const markdown = raw ? raw.replace(/^---[\s\S]*?---\n?/, '') : null;

  // Load post metadata to get title/cover etc.
  const postsRes = await fetch('/metadata/posts.json');
  const allPosts: import('$lib/types').Post[] = postsRes.ok ? await postsRes.json() : [];
  const post = allPosts.find((p) => p.slug === slug) ?? null;
  const dirsRes = await fetch('/metadata/blog-dirs.json');
  const blogDirs = dirsRes.ok ? await dirsRes.json() : {};

  return { slug, markdown, post, allPosts, blogDirs };
};
