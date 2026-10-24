<script lang="ts">
	import { tick } from 'svelte';
	import { initArticleFeatures } from '$lib/markdown';
	import ContentFooter from '$lib/components/ContentFooter.svelte';
	import { splitLeadingHeading } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const doc = $derived(data.doc);
	const markdown = $derived(data.markdown);
	const slug = $derived(data.slug);
	const config = $derived(data.config);
	const nextPage = $derived(data.nextPage);
	const previousPage = $derived(data.previousPage);

	const renderedHtml = $derived(data.renderedHtml ?? '');
	let articleEl: HTMLElement | null = null;
	const rendered = $derived(splitLeadingHeading(renderedHtml));
	const headerTitle = $derived(rendered.title ?? doc?.title ?? '');

	// Content is prerendered in load() so crawlers receive real documentation.
	// Only interactive enhancements run in the browser.
	$effect(() => {
		if (!renderedHtml) return;
		void tick().then(async () => {
			if (articleEl) await initArticleFeatures(articleEl);
			if (location.hash) {
				const target = document.querySelector(location.hash);
				if (target) target.scrollIntoView({ behavior: 'smooth' });
			}
		});
	});
</script>

<svelte:head>
	<title>{doc?.title ?? slug} · {config?.hero_title ?? 'Raksara'}</title>
	{#if doc?.summary}<meta name="description" content={doc.summary} />{/if}
</svelte:head>

<article bind:this={articleEl}>
	<div class="article-top-bar">
		<a href="/doc" class="back-link">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			Back to Doc
		</a>
	</div>

	{#if headerTitle}
		<header class="page-header">
			<div>
				<h1 class="page-title">{headerTitle}</h1>
				{#if doc?.summary}<p class="page-subtitle">{doc.summary}</p>{/if}
			</div>
		</header>
	{/if}
	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body">{@html rendered.body}</div>
	{:else if !markdown}
		<p style="color: var(--text-secondary);">Doc page not found.</p>
	{:else}
		<p style="color: var(--text-tertiary);">Loading…</p>
	{/if}
</article>

{#if previousPage || nextPage}
	<nav class="post-nav" aria-label="Documentation navigation">
		{#if previousPage}
			<a class="post-nav-link prev" href={previousPage.href}>
				<span class="post-nav-label">← Previous</span>
				<span class="post-nav-title">{previousPage.title}</span>
			</a>
		{:else}
			<span></span>
		{/if}
		{#if nextPage}
			<a class="post-nav-link next" href={nextPage.href}>
				<span class="post-nav-label">Next →</span>
				<span class="post-nav-title">{nextPage.title}</span>
			</a>
		{/if}
	</nav>
{/if}

<ContentFooter author={config?.author} logo={config?.logo} />
