<script lang="ts">
	import { tick } from 'svelte';
	import { renderMarkdown, initArticleFeatures } from '$lib/markdown';
	import ContentFooter from '$lib/components/ContentFooter.svelte';

	type DocNav = { href: string; title: string };
	let { data }: { data: { doc?: { title?: string; summary?: string }; markdown?: string | null; slug: string; config?: { hero_title?: string; author?: string }; nextPage?: DocNav | null; previousPage?: DocNav | null } } = $props();
	const doc = $derived(data.doc);
	const markdown = $derived(data.markdown);
	const slug = $derived(data.slug);
	const config = $derived(data.config);
	const nextPage = $derived(data.nextPage);
	const previousPage = $derived(data.previousPage);

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

	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body">{@html renderedHtml}</div>
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

<ContentFooter author={config?.author} />
