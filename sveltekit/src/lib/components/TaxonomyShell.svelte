<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { SiteConfig, TaxonomyArchivePage, TaxonomyIndex, TaxonomyKind } from '$lib/types';
	import { loadTaxonomyIndex, loadTaxonomyPage } from '$lib/metadata';
	import { isHighlightedTag, taxonomyHref } from '$lib/taxonomy.js';
	import { serializeJsonLd } from '$lib/seo';
	import TaxonomyArchive from './TaxonomyArchive.svelte';

	let { kind, config, fixedTerm, initialArchive, initialIndex }: {
		kind: TaxonomyKind;
		config: SiteConfig;
		fixedTerm?: string;
		initialArchive?: TaxonomyArchivePage | null;
		initialIndex?: TaxonomyIndex | null;
	} = $props();

	let mounted = $state(false);
	let selectedTerm = $state('');
	let loadedArchive = $state<TaxonomyArchivePage | null>(null);
	let status = $state<'selection' | 'loading' | 'ready' | 'unknown' | 'invalid' | 'error'>('selection');
	let errorMessage = $state('');
	let retry = $state(0);
	let registryCache: TaxonomyIndex | null = null;
	const term = $derived(mounted ? selectedTerm : fixedTerm ?? '');
	const archive = $derived(mounted ? loadedArchive : initialArchive ?? null);
	const topic = $derived(kind === 'tag' && term && config.topics && Object.hasOwn(config.topics, term) ? config.topics[term] : null);
	const displayName = $derived(topic?.title?.trim() || (kind === 'tag' ? topicName(term) : term));
	const siteName = $derived(config.hero_title ?? config.title ?? 'Raksara');
	const fallbackLinks = $derived((config.nav ?? []).filter(link => typeof link.href === 'string' && link.href.startsWith('/') && !link.href.startsWith('/tag/') && !link.href.startsWith('/category/')));

	const intro = $derived(topic?.intro?.trim() || topic?.description?.trim() || (term ? `Content collected under ${displayName}.` : `Choose a ${kind} to browse its content.`));
	const title = $derived(term ? `${displayName}${kind === 'tag' ? ' articles' : ''} · ${siteName}` : `Browse by ${kind} · ${siteName}`);
	const root = $derived(String(config.site_url || config.url || '').replace(/\/+$/, ''));
	const collectionJsonLd = $derived(fixedTerm && archive ? {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: `${displayName} | ${siteName}`,
		description: intro,
		url: `${root}${taxonomyHref('tag', fixedTerm, config)}`,
		about: { '@type': 'Thing', name: displayName },
		mainEntity: {
			'@type': 'ItemList',
			itemListOrder: 'https://schema.org/ItemListOrderDescending',
			numberOfItems: archive.posts.length,
			itemListElement: archive.posts.map((post, index) => ({
				'@type': 'ListItem', position: index + 1,
				url: `${root}/blog/post/${post.slug}/`, name: post.title
			}))
		}
	} : null);

	function topicName(value: string): string {
		if (value.toLowerCase() === 'java') return 'Java';
		return value.split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
	}

	function pageHref(target: number): string {
		const url = new URL($page.url);
		if (target > 1) url.searchParams.set('page', String(target));
		else url.searchParams.delete('page');
		return `${url.pathname}${url.search}${url.hash}`;
	}

	onMount(() => { mounted = true; });
	$effect(() => {
		if (!mounted) return;
		const search = $page.url.searchParams;
		const currentKind = kind;
		const currentConfig = config;
		const currentSeed = initialArchive;
		const currentIndex = initialIndex;
		const currentTerm = fixedTerm ?? search.get('name') ?? '';
		const retryAttempt = retry;
		selectedTerm = currentTerm;
		errorMessage = '';
		loadedArchive = null;
		if ((!fixedTerm && search.getAll('name').length > 1) || search.getAll('page').length > 1) {
			status = 'invalid';
			return;
		}
		if (!currentTerm.trim()) {
			status = 'selection';
			return;
		}
		const rawPage = search.get('page') ?? '1';
		const requested = /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0 ? Number(rawPage) : 1;
		if (!fixedTerm && currentKind === 'tag' && isHighlightedTag(currentTerm, currentConfig)) {
			status = 'loading';
			const href = taxonomyHref('tag', currentTerm, currentConfig);
			let active = true;
			void goto(`${href}${requested > 1 ? `?page=${requested}` : ''}${$page.url.hash}`, { replaceState: true }).catch(error => {
				if (!active) return;
				status = 'error';
				errorMessage = error instanceof Error ? error.message : 'Navigation failed.';
			});
			return () => { active = false; };
		}
		if (retryAttempt === 0 && currentSeed?.term === currentTerm && requested === 1) {
			loadedArchive = currentSeed;
			status = 'ready';
			return;
		}
		status = 'loading';
		const controller = new AbortController();
		void (async () => {
			try {
				const registry = (retryAttempt === 0 ? currentIndex : null) ?? registryCache ?? await loadTaxonomyIndex(fetch, controller.signal);
				if (controller.signal.aborted) return;
				registryCache = registry;
				const terms = currentKind === 'tag' ? registry.tags : registry.categories;
				const entry = Object.hasOwn(terms, currentTerm) ? terms[currentTerm] : null;
				if (!entry) { status = 'unknown'; return; }
				const targetPage = Math.min(requested, entry.pages);
				const result = await loadTaxonomyPage(fetch, currentKind, entry.id, targetPage, controller.signal);
				if (controller.signal.aborted) return;
				if (result.term !== currentTerm || result.total !== entry.total || result.pages !== entry.pages || result.pageSize !== registry.pageSize) {
					throw new Error('Archive data changed. Reload the page and try again.');
				}
				loadedArchive = result;
				status = 'ready';
			} catch (error) {
				if (controller.signal.aborted) return;
				registryCache = null;
				status = 'error';
				errorMessage = error instanceof Error ? error.message : 'Unable to load archive content.';
			}
		})();
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={intro} />
	{#if collectionJsonLd}{@html `<script type="application/ld+json">${serializeJsonLd(collectionJsonLd)}</script>`}{/if}
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">{displayName || `Browse by ${kind}`}</h1>
		<p class="page-subtitle">{intro}</p>
	</div>
</div>

{#if archive}
	<p class="page-subtitle" aria-live="polite">{archive.total} item{archive.total !== 1 ? 's' : ''}{archive.pages > 1 ? ` · Page ${archive.page} of ${archive.pages}` : ''} · newest first</p>
	<TaxonomyArchive {archive} {config} />
	{#if archive.pages > 1}
		<nav class="taxonomy-detail-pagination" aria-label="Archive pagination">
			{#if archive.page > 1}<a class="home-btn home-btn-secondary" href={pageHref(archive.page - 1)} aria-controls="taxonomy-detail-results">Previous</a>{/if}
			<span aria-live="polite">Page {archive.page} of {archive.pages}</span>
			{#if archive.page < archive.pages}<a class="home-btn home-btn-secondary" href={pageHref(archive.page + 1)} aria-controls="taxonomy-detail-results">Next</a>{/if}
		</nav>
	{/if}
{:else if status === 'loading'}
	<p class="taxonomy-detail-status" role="status">Loading archive…</p>
{:else if status === 'error'}
	<div class="taxonomy-detail-status" role="alert"><p>Unable to load this archive. {errorMessage}</p><button type="button" class="home-btn home-btn-secondary" onclick={() => retry += 1}>Retry</button></div>
{:else if status === 'invalid'}
	<p class="taxonomy-detail-status" role="status">Invalid archive URL. Use a single name and page parameter.</p>
{:else if status === 'unknown'}
	<p class="taxonomy-detail-status" role="status">No {kind} named <strong>{term}</strong> was found.</p>
{:else}
	<p class="taxonomy-detail-status" role="status">Choose a {kind} from the <a href={kind === 'tag' ? '/tags/' : '/categories/'}>{kind === 'tag' ? 'tags' : 'categories'} directory</a>.</p>
{/if}

{#if !fixedTerm}
	<!-- Shared noindex shells still provide useful, crawlable destinations without JS. -->
	<nav class="taxonomy-start-here" aria-label="Explore published content">
		<p>Explore other sections of the site or start with a featured topic:</p>
		<div class="taxonomy-start-links">
			{#each fallbackLinks as link}
				<a class="tag" href={link.href}>{link.label}</a>
			{/each}
			{#each config.taxonomy?.highlighted_tags ?? [] as highlighted}
				<a class="tag" href={taxonomyHref('tag', highlighted, config)}>
					{config.topics?.[highlighted]?.title ?? topicName(highlighted)}
				</a>
			{/each}
		</div>
	</nav>
	<noscript><p>JavaScript is needed to browse this archive. Use the links above or the site navigation to continue.</p></noscript>
{:else if initialArchive && initialArchive.pages > 1}
	<noscript><p>The first page is shown above. JavaScript is needed to browse further archive pages.</p></noscript>
{/if}

<style>
	.taxonomy-start-here { margin: 16px 0 28px; color: var(--text-secondary); }
	.taxonomy-start-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
	.taxonomy-detail-status { min-height: 120px; color: var(--text-secondary); }
	.taxonomy-detail-pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:16px; margin:24px 0; }
	.taxonomy-detail-pagination a { min-height:44px; }
</style>
