import type { PageLoad } from './$types';
import { loadConfig, loadDocs, loadGallery, loadPages, loadPortfolio, loadPosts, loadThoughts, loadTags, loadCategories } from '$lib/metadata';
import { adminContentTypes } from '$lib/admin/custom-components';
import { resolveAdminConfig } from '$lib/admin/admin-config';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const [config, posts, portfolio, gallery, thoughts, pages, docs, tagsMap, categoriesMap] = await Promise.all([
		loadConfig(fetch).catch(() => null),
		loadPosts(fetch).catch(() => []),
		loadPortfolio(fetch).catch(() => []),
		loadGallery(fetch).catch(() => []),
		loadThoughts(fetch).catch(() => []),
		loadPages(fetch).catch(() => []),
		loadDocs(fetch).catch(() => []),
		loadTags(fetch).catch(() => ({} as Record<string, number>)),
		loadCategories(fetch).catch(() => ({} as Record<string, number>))
	]);

	// Tags sorted by frequency desc
	const existingTags = Object.entries(tagsMap)
		.sort((a, b) => b[1] - a[1])
		.map(([tag]) => tag);

	// Categories sorted by frequency desc
	const existingCategories = Object.entries(categoriesMap)
		.sort((a, b) => b[1] - a[1])
		.map(([cat]) => cat);

	// All known slugs for uniqueness check
	const existingSlugs = new Set([
		...posts.map((p) => p.slug),
		...portfolio.map((p) => p.slug),
		...gallery.map((g) => g.slug),
		...thoughts.map((t) => t.slug),
		...pages.map((p) => p.slug)
	]);

	// Items available for prev/next navigation selection in the admin form
	const navItems: Array<{ title: string; slug: string; section: 'blog' | 'pages' }> = [
		...posts.map((p) => ({ title: p.title, slug: p.slug, section: 'blog' as const })),
		...pages.map((p) => ({ title: p.title, slug: p.slug, section: 'pages' as const })),
		...docs.map((p) => ({ title: p.title, slug: p.slug, section: 'pages' as const }))
	];

	return {
		admin: resolveAdminConfig(config),
		contentTypes: adminContentTypes,
		existingTags,
		existingCategories,
		existingSlugs: [...existingSlugs],
		navItems,
		counts: {
			blog: posts.length,
			portfolio: portfolio.length,
			gallery: gallery.length,
			thoughts: thoughts.length,
			pages: pages.length,
			docs: docs.length
		}
	};
};
