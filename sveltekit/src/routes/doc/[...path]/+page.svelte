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

	let renderedHtml = $state('');
	let articleEl: HTMLElement | null = null;

	$effect(() => {
		const source = markdown;
		if (!source) {
			renderedHtml = '';
			return;
		}
		(async () => {
			renderedHtml = await renderMarkdown(source);
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
	<nav class="mb-4 text-sm" aria-label="Breadcrumb">
		<a href="/documentation" style="color: var(--accent);">Documentation</a>
		<span class="mx-2" style="color: var(--text-tertiary);">›</span>
		<span style="color: var(--text-secondary);">{page?.title ?? slug}</span>
	</nav>

	<h1 class="mb-6 text-3xl font-bold" style="color: var(--text-primary);">{page?.title ?? slug}</h1>
	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body prose" style="color: var(--text-primary);">{@html renderedHtml}</div>
	{:else if !markdown}
		<p style="color: var(--text-secondary);">Page not found.</p>
	{:else}
		<p style="color: var(--text-tertiary);">Loading…</p>
	{/if}
</article>

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

<ContentFooter author={config?.author} />
