<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import { initArticleFeatures } from '$lib/markdown';
	import ContentFooter from '$lib/components/ContentFooter.svelte';
	import { splitLeadingHeading } from '$lib/utils';

	let { data }: { data: PageData } = $props();
	const page = $derived(data.page);
	const markdown = $derived(data.markdown);
	const slug = $derived(data.slug);
	const config = $derived(data.config);
	const nextPage = $derived(data.nextPage);
	const previousPage = $derived(data.previousPage);
	const docs = $derived(data.docs);
	const rendered = $derived(splitLeadingHeading(data.renderedHtml ?? ''));
	const renderedHtml = $derived(rendered.body);
	const headerTitle = $derived(rendered.title ?? page?.title ?? '');
	const pageDescription = $derived(
		page?.summary?.trim()
			|| page?.description?.trim()
			|| (page?.title ? `Explore ${page.title} on ${config?.hero_title ?? config?.title ?? 'Raksara'}.` : '')
			|| config?.description
			|| config?.hero_subtitle
			|| config?.hero_title
			|| config?.title
			|| ''
	);

	let articleEl: HTMLElement | null = null;

	onMount(async () => {
		await tick();
		if (articleEl) await initArticleFeatures(articleEl);
		if (location.hash) {
			const target = document.querySelector(location.hash);
			if (target) target.scrollIntoView({ behavior: 'smooth' });
		}
	});
</script>

<svelte:head>
	<title>{page?.title ?? slug} · {config?.hero_title ?? config?.title ?? 'Raksara'}</title>
	<meta name="description" content={pageDescription} />
</svelte:head>

<article bind:this={articleEl} class="mx-auto max-w-3xl standalone-page">
	{#if headerTitle}
		<header class="page-header">
			<div>
				<h1 class="page-title">{headerTitle}</h1>
				{#if page?.summary}<p class="page-subtitle">{page.summary}</p>{/if}
			</div>
		</header>
	{/if}
	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body prose" style="color: var(--text-primary);">{@html renderedHtml}</div>
	{:else if !markdown}
		<p style="color: var(--text-secondary);">Page not found.</p>
	{:else}
		<p style="color: var(--text-tertiary);">Loading…</p>
	{/if}
</article>

{#if slug === 'about'}
	<section class="docs-section mx-auto max-w-3xl" aria-labelledby="docs-section-title">
		<div class="docs-frame">
			<div class="docs-card">
				<span class="docs-card-glow" aria-hidden="true"></span>
				<div class="docs-card-head">
					<span class="docs-card-icon" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 4.2C6.7 3.1 4.8 2.6 2.5 2.7v9.6c2.3-.1 4.2.4 5.5 1.5 1.3-1.1 3.2-1.6 5.5-1.5V2.7c-2.3-.1-4.2.4-5.5 1.5zM8 4.2v9.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</span>
					<div>
						<span class="docs-card-eyebrow">Raksara · Docs{#if docs?.length} · {docs.length} pages{/if}</span>
						<h2 id="docs-section-title">Documentation</h2>
					</div>
				</div>
				<p>Raksara supports a set of custom components — panels, containers, chips, and sortable tables — available directly in Markdown with simple syntax extensions.</p>
				<ul class="docs-card-chips" aria-label="Component highlights">
					<li>Panels</li>
					<li>Containers</li>
					<li>Chips</li>
					<li>Sortable tables</li>
				</ul>
				<a href="/documentation/" class="home-btn home-btn-secondary">
					View component documentation
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</a>
			</div>
		</div>
	</section>
{/if}

<!-- BL-013: prev/next doc navigation -->
{#if previousPage || nextPage}
<nav class="mx-auto mt-8 flex max-w-3xl justify-between gap-4" aria-label="Page navigation">
	{#if previousPage}
		<a
			href="/{previousPage}"
			class="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm transition-colors hover:opacity-80"
			style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
		>← Previous</a>
	{:else}
		<span></span>
	{/if}
	{#if nextPage}
		<a
			href="/{nextPage}"
			class="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm transition-colors hover:opacity-80"
			style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
		>Next →</a>
	{/if}
</nav>
{/if}

<!-- BL-024: Documentation pages list (injected on the /documentation page) -->
{#if slug === 'documentation-index-fallback' && docs && docs.length > 0}
<section class="mx-auto mt-12 max-w-3xl">
	<h2 class="mb-4 text-xl font-semibold" style="color: var(--text-primary);">Documentation</h2>
	<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each docs as doc}
			<li>
				<a
					href="/{doc.slug}"
					class="block rounded-xl border p-4 transition-colors hover:opacity-80"
					style="background: var(--bg-card); border-color: var(--border-color);"
				>
					<h3 class="font-medium" style="color: var(--text-primary);">{doc.title}</h3>
					{#if doc.summary}
						<p class="mt-1 text-sm" style="color: var(--text-secondary);">{doc.summary}</p>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</section>
{/if}

<ContentFooter author={config?.author} logo={config?.logo} />
