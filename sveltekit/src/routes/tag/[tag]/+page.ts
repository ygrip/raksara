import type { PageLoad } from './$types';
import { loadTaxonomyIndex, loadTaxonomyPage } from '$lib/metadata';
import { isHighlightedTag } from '$lib/taxonomy.js';

// The generated manifest contains only the explicit highlighted-tag allowlist.
// Other legacy paths stay available to the client router, not the static build.
export const prerender = 'auto';

export const load: PageLoad = async ({ params, fetch, parent }) => {
  const { config } = await parent();
  const tag = params.tag;
  if (!isHighlightedTag(tag, config)) return { tag, archive: null, taxonomyIndex: null };

  const taxonomyIndex = await loadTaxonomyIndex(fetch);
  const entry = Object.hasOwn(taxonomyIndex.tags, tag) ? taxonomyIndex.tags[tag] : null;
  if (!entry) throw new Error(`Highlighted tag "${tag}" is missing from the taxonomy registry`);
  const archive = await loadTaxonomyPage(fetch, 'tag', entry.id);
  if (archive.term !== tag || archive.total !== entry.total || archive.pages !== entry.pages || archive.pageSize !== taxonomyIndex.pageSize) {
    throw new Error(`Highlighted tag "${tag}" has mismatched archive data`);
  }
  return { tag, archive, taxonomyIndex };
};
