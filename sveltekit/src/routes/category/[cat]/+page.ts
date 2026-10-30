import type { PageLoad } from './$types';
import { loadTaxonomyIndex, loadTaxonomyPage } from '$lib/metadata';
import { isHighlightedCategory } from '$lib/taxonomy.js';

// The generated manifest contains only the explicit highlighted-tag allowlist.
// Other legacy paths stay available to the client router, not the static build.
export const prerender = 'auto';

export const load: PageLoad = async ({ params, fetch, parent }) => {
  const { config } = await parent();
  const cat = params.cat;
  if (!isHighlightedCategory(cat, config)) return { cat, archive: null, taxonomyIndex: null };

  const taxonomyIndex = await loadTaxonomyIndex(fetch);
  const entry = Object.hasOwn(taxonomyIndex.categories, cat) ? taxonomyIndex.categories[cat] : null;
  if (!entry) throw new Error(`Highlighted category "${cat}" is missing from the taxonomy registry`);
  const archive = await loadTaxonomyPage(fetch, 'category', entry.id);
  if (archive.term !== cat || archive.total !== entry.total || archive.pages !== entry.pages || archive.pageSize !== taxonomyIndex.pageSize) {
    throw new Error(`Highlighted category "${cat}" has mismatched archive data`);
  }
  return { cat, archive, taxonomyIndex };
};
