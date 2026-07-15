import { loadConfig } from '$lib/metadata';
import type { LayoutLoad } from './$types';

export const prerender = true;
export const trailingSlash = 'always';

export const load = (async ({ fetch }) => {
  // Use SvelteKit's request-aware fetch so static metadata is available during
  // SSR/prerender and serialized into the generated HTML for hydration.
  const config = await loadConfig(fetch);

  if (!config.site_url) {
    throw new Error('Missing required site_url in generated metadata/config.json');
  }

  if (!config.color) {
    throw new Error('Missing required color in generated metadata/config.json');
  }

  return { config };
}) satisfies LayoutLoad;
