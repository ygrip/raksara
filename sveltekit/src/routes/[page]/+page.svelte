<script lang="ts">
	import { tick } from 'svelte';
	import type { PageData } from './$types';
	import { renderMarkdown, initArticleFeatures } from '$lib/markdown';
	import ContentFooter from '$lib/components/ContentFooter.svelte';

	let { data }: { data: PageData } = $props();
	const page = $derived(data.page);
	const markdown = $derived(data.markdown);
	const slug = $derived(data.slug);
	const config = $derived(data.config);
	const nextPage = $derived(data.nextPage);
	const previousPage = $derived(data.previousPage);
	const docs = $derived(data.docs);
	const componentEntries = $derived(data.componentEntries);
	const posts = $derived(data.posts ?? []);
	const portfolioItems = $derived(data.portfolioItems ?? []);
	const imageManifest = $derived(data.imageManifest ?? null);

	let renderedHtml = $state('');
	let articleEl: HTMLElement | null = null;

	$effect(() => {
		const source = markdown;
		const entries = componentEntries ?? [];
		if (!source) {
			renderedHtml = '';
			return;
		}
		(async () => {
			renderedHtml = await renderMarkdown(source, {
				components: entries,
				context: { posts, portfolioItems },
				imageManifest: imageManifest ?? undefined,
			});
			await tick();
			if (articleEl) await initArticleFeatures(articleEl);
			if (location.hash) {
				const target = document.querySelector(location.hash);
				if (target) target.scrollIntoView({ behavior: 'smooth' });
			}
		})();
	});
</script>

<svelte:head>
	<title>{page?.title ?? slug} · {config?.hero_title ?? config?.title ?? 'Raksara'}</title>
	{#if page?.summary}<meta name="description" content={page.summary} />{/if}
</svelte:head>

<article bind:this={articleEl} class="mx-auto max-w-3xl">
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
	<section class="docs-section mx-auto max-w-3xl">
		<h2>Documentation</h2>
		<p>Raksara supports a set of custom components — panels, containers, chips, and sortable tables — available directly in Markdown with simple syntax extensions.</p>
		<a href="/documentation" class="docs-section-link">View component documentation →</a>
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

<ContentFooter author={config?.author} />
