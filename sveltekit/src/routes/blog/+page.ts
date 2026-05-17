// src/routes/blog/+page.ts
import { loadPosts, loadBlogDirs, loadImageManifest } from '$lib/metadata';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [posts, blogDirs, imageManifest] = await Promise.all([
    loadPosts(fetch).catch(() => [] as import('$lib/types').Post[]),
    loadBlogDirs(fetch).catch(() => ({})),
    loadImageManifest(fetch).catch(() => null),
  ]);
  return { posts, blogDirs, imageManifest };
};
