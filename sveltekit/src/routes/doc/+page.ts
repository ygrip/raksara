import { loadDocs } from '$lib/metadata';

export const prerender = true;

export const load = async ({ fetch }: { fetch: typeof globalThis.fetch }) => {
  const docs = await loadDocs(fetch).catch(() => []);
  return { docs };
};
