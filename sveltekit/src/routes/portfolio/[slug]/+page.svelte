<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import { initArticleFeatures } from '$lib/markdown';
	import Giscus from '$lib/components/Giscus.svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import { shouldShowGiscus, getGiscusConfig, buildPostMeta, buildBreadcrumbSchema, serializeJsonLd } from '$lib/seo';
	import { assetUrl, formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import ContentFooter from '$lib/components/ContentFooter.svelte';

	let { data }: { data: PageData } = $props();
	const item = $derived(data.item);
	const markdown = $derived(data.markdown);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const renderedHtml = $derived(data.renderedHtml ?? '');
	const articleCoverSizes = '(max-width: 832px) calc(100vw - 32px), 800px';

	let articleEl: HTMLElement | null = null;

	const giscusConfig = $derived(config ? getGiscusConfig(config) : null);
	const showGiscus = $derived(config ? shouldShowGiscus(config, 'portfolio') : false);
	const pageMeta = $derived(item && config ? buildPostMeta(item as unknown as import('$lib/types').Post, config, item.slug) : null);
	const breadcrumbJsonLd = $derived(
		item && config
			? buildBreadcrumbSchema(
					[
						{ name: 'Home', url: '/' },
						{ name: 'Portfolio', url: '/portfolio/' },
						{ name: item.title, url: `/portfolio/${item.slug}/` },
					],
					String(config.site_url ?? config.url ?? '')
				)
			: null
	);

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
	<title>{item?.title ?? 'Project'} · {config?.hero_title ?? config?.title ?? ''}</title>
	{#if item?.summary}<meta name="description" content={item.summary} />{/if}
	<meta property="og:title" content={item?.title ?? ''} />
	<meta property="og:description" content={item?.summary ?? ''} />
	{#if item?.ogImage?.landscape || pageMeta?.image}
		{@const ogLandscape = item?.ogImage?.landscape ?? pageMeta?.image}
		{@const ogPortrait = item?.ogImage?.portrait}
		<meta property="og:image" content={ogLandscape} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		{#if ogPortrait}
			<meta property="og:image" content={ogPortrait} />
			<meta property="og:image:width" content="1080" />
			<meta property="og:image:height" content="1350" />
		{/if}
		<meta name="twitter:image" content={ogLandscape} />
	{/if}
	{#if pageMeta?.jsonLd}
		{@html `<script type="application/ld+json">${serializeJsonLd(pageMeta.jsonLd)}</script>`}
	{/if}
	{#if breadcrumbJsonLd}
		{@html `<script type="application/ld+json">${serializeJsonLd(breadcrumbJsonLd)}</script>`}
	{/if}
</svelte:head>

<article bind:this={articleEl}>
	<div class="article-top-bar">
		<a href="/portfolio" class="back-link article-back-link">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			Back to Portfolio
		</a>
		{#if item}
			<ShareCard
				title={item.title}
				summary={item.summary}
				author={config?.author}
				coverUrl={assetUrl(item.cover)}
				tags={item.tags}
				date={item.date}
			/>
		{/if}
	</div>

	<header class="article-header">
		{#if item?.cover}
			{@const coverLqip = buildLqipStyle(item.cover, imageManifest)}
			<div class="article-cover is-loading" class:lqip-shown={!!coverLqip} style={coverLqip}>
				<img {...buildResponsiveAttrs(item.cover, imageManifest, { sizes: articleCoverSizes, eager: true })} alt={item.title} />
			</div>
		{/if}

		<h1>{item?.title ?? ''}</h1>

		<div class="article-meta">
			{#if item?.category}
				<a href="/category/{item.category}" class="post-card-category">{item.category}</a>
			{/if}
			{#if item?.status}
				<span class="status-chip status-{item.status}">{item.status}</span>
			{/if}
			{#if item?.date}
				<time>{formatDate(item.date)}</time>
			{/if}
			{#each (item?.tags ?? []) as tag}
				<a href="/tag/{tag}" class="tag">{tag}</a>
			{/each}
		</div>

		<div class="portfolio-detail-links">
			{#if item?.github}
				<a href={item.github} target="_blank" rel="noopener noreferrer" class="btn-github">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
					GitHub
				</a>
			{/if}
			{#if item?.demo}
				<a href={item.demo} target="_blank" rel="noopener noreferrer" class="btn-demo">Demo ↗</a>
			{/if}
		</div>
	</header>

	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body prose" style="color: var(--text-primary);">{@html renderedHtml}</div>
	{:else if !markdown}
		<p style="color: var(--text-secondary);">Project not found.</p>
	{:else}
		<p style="color: var(--text-tertiary);">Loading…</p>
	{/if}

	{#if showGiscus && giscusConfig}
		<Giscus
			repo={giscusConfig.repo}
			repoId={giscusConfig.repoId}
			category={giscusConfig.category}
			categoryId={giscusConfig.categoryId}
			term={item?.slug}
			mapping="specific"
			theme="dark_dimmed"
		/>
	{/if}
</article>
<ContentFooter author={config?.author} />
