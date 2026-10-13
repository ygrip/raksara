import type { PageLoad } from './$types';

export const prerender = false;

// Legacy client-route compatibility only. Fresh requests on GitHub Pages still
// receive its 404 fallback unless a hosting layer supplies an HTTP redirect.
export const load: PageLoad = ({ params }) => ({ cat: params.cat });
