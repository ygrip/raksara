// src/routes/blog/+page.ts
import { loadPosts, loadBlogDirs } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [posts, blogDirs] = await Promise.all([
    loadPosts(fetch).catch(() => [] as import('$lib/types').Post[]),
    loadBlogDirs(fetch).catch(() => ({})),
  ]);
  return { posts, blogDirs };
};
