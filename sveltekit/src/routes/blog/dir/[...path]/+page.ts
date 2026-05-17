// src/routes/blog/dir/[...path]/+page.ts
import type { PageLoad } from './$types';
import { loadPosts, loadBlogDirs } from '$lib/metadata';

export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const dirPath = (params.path ?? '').replace(/\/+$/, '');
  const [posts, blogDirs] = await Promise.all([
    loadPosts(fetch).catch(() => [] as import('$lib/types').Post[]),
    loadBlogDirs(fetch).catch(() => ({})),
  ]);
  const dirPosts = posts.filter((p) => p.dir === dirPath);
  const subDirEntry = (blogDirs as import('$lib/types').BlogDirs)[dirPath];
  const subdirs = (subDirEntry?.subdirs ?? []).map((name) => {
    const fullPath = dirPath ? `${dirPath}/${name}` : name;
    const entry = (blogDirs as import('$lib/types').BlogDirs)[fullPath];
    return {
      name,
      path: fullPath,
      count: entry?.posts?.length ?? 0,
    };
  });
  return { dirPath, posts: dirPosts, subdirs };
};
