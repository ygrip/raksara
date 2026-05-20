<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { renderMarkdown, initArticleFeatures } from '$lib/markdown';
	import Giscus from '$lib/components/Giscus.svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import { shouldShowGiscus, getGiscusConfig, buildPostMeta } from '$lib/seo';
	import { assetUrl, formatDate, humanize } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import ContentFooter from '$lib/components/ContentFooter.svelte';

	type ChapterNav = { title: string; href: string };

	let { data }: { data: PageData } = $props();
	const post = $derived(data.post);
	const markdown = $derived(data.markdown);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const articleCoverSizes = '(max-width: 832px) calc(100vw - 32px), 800px';

	let renderedHtml = $state('');
	let articleEl: HTMLElement | null = null;

	// Derived article type
	const postType = $derived(post?.type ?? 'blog');
	const isPoem = $derived(postType === 'poem');
	const isNovel = $derived(postType === 'novel' || postType === 'chapters');

	// Chapter (series) navigation
	const allPosts = $derived((data as Record<string, unknown> & typeof data).allPosts as import('$lib/types').Post[] ?? []);
	const manualNextPage = $derived((data as Record<string, unknown> & { nextPage?: ChapterNav | null }).nextPage ?? null);
	const manualPreviousPage = $derived((data as Record<string, unknown> & { previousPage?: ChapterNav | null }).previousPage ?? null);
	const seriesSlug = $derived(post?.series ?? post?.dir ?? null);
	const chapterOrder = (item: import('$lib/types').Post): number => {
		const explicit = Number((item as import('$lib/types').Post & { order?: string | number }).chapter ?? (item as import('$lib/types').Post & { order?: string | number }).order ?? NaN);
		if (Number.isFinite(explicit) && explicit > 0) return explicit;
		const fromSlug = item.slug?.match(/(?:^|\/)ch-(\d+)(?:$|[^0-9])/i);
		if (fromSlug?.[1]) return Number(fromSlug[1]);
		return Number.POSITIVE_INFINITY;
	};
	const seriesPosts = $derived(
		seriesSlug ? allPosts.filter((p: import('$lib/types').Post) => (p.series ?? p.dir) === seriesSlug).sort((a: import('$lib/types').Post, b: import('$lib/types').Post) => {
			const aIdx = chapterOrder(a);
			const bIdx = chapterOrder(b);
			if (aIdx !== bIdx) return aIdx - bIdx;
			if (a.date !== b.date) return a.date.localeCompare(b.date);
			return a.slug.localeCompare(b.slug);
		}) : []
	);
	const currentIdx = $derived(seriesPosts.findIndex((p: import('$lib/types').Post) => p.slug === post?.slug));
	const prevChapter = $derived(currentIdx > 0 ? seriesPosts[currentIdx - 1] : null);
	const nextChapter = $derived(currentIdx >= 0 && currentIdx < seriesPosts.length - 1 ? seriesPosts[currentIdx + 1] : null);
	const chapterPrevNav = $derived(manualPreviousPage ?? (prevChapter ? { title: prevChapter.title, href: `/blog/post/${prevChapter.slug}` } : null));
	const chapterNextNav = $derived(manualNextPage ?? (nextChapter ? { title: nextChapter.title, href: `/blog/post/${nextChapter.slug}` } : null));
	const breadcrumbs = $derived((post?.slug ?? '').split('/').filter(Boolean));
	const breadcrumbParent = $derived(
		breadcrumbs.length > 1
			? {
				title: humanize(breadcrumbs[breadcrumbs.length - 2]),
				href: `/blog/dir/${breadcrumbs.slice(0, -1).join('/')}`,
			}
			: null
	);
	const breadcrumbUp = $derived(
		breadcrumbs.length > 2
			? {
				title: '../',
				href: `/blog/dir/${breadcrumbs.slice(0, -2).join('/')}`,
			}
			: null
	);
	const compactBreadcrumbs = $derived.by(() => {
		const current = { title: post?.title ?? '', href: null as string | null, current: true };
		if (!breadcrumbParent && !breadcrumbUp) {
			return [{ title: 'Blog', href: '/blog', current: false }, current];
		}
		if (breadcrumbParent && breadcrumbUp) {
			return [
				{ title: breadcrumbUp.title, href: breadcrumbUp.href, current: false },
				{ title: breadcrumbParent.title, href: breadcrumbParent.href, current: false },
				current,
			];
		}
		if (breadcrumbParent) {
			return [
				{ title: 'Blog', href: '/blog', current: false },
				{ title: breadcrumbParent.title, href: breadcrumbParent.href, current: false },
				current,
			];
		}
		return [{ title: 'Blog', href: '/blog', current: false }, current];
	});
	const compactIsDeep = $derived(!!breadcrumbUp && !!breadcrumbParent);

	// SEO/Giscus
	const giscusConfig = $derived(config ? getGiscusConfig(config) : null);
	const showGiscus = $derived(config ? shouldShowGiscus(config, 'blog', post?.comments_enabled) : false);
	const pageMeta = $derived(post && config ? buildPostMeta(post, config, post.slug) : null);

	// BL-009: reading mode toggle (persisted in sessionStorage)
	let readingMode = $state(false);
	onMount(() => {
		readingMode = sessionStorage.getItem('readingMode') === '1';
		document.body.classList.toggle('reading-mode', readingMode);
	});
	onDestroy(() => {
		if (!browser) return;
		document.body.classList.remove('reading-mode');
	});
	function toggleReadingMode() {
		readingMode = !readingMode;
		sessionStorage.setItem('readingMode', readingMode ? '1' : '0');
		document.body.classList.toggle('reading-mode', readingMode);
	}

	// BL-010: comic scroll mode toggle
	const isComic = $derived(postType === 'comic');
	let comicScrollMode = $state<'scroll' | 'page'>('scroll');
	onMount(() => {
		const saved = sessionStorage.getItem('comicScrollMode');
		if (saved === 'page' || saved === 'scroll') comicScrollMode = saved;
	});
	function toggleComicMode() {
		comicScrollMode = comicScrollMode === 'scroll' ? 'page' : 'scroll';
		sessionStorage.setItem('comicScrollMode', comicScrollMode);
	}

	function stripLeadingTitle(md: string, title?: string | null): string {
		if (!title) return md;
		const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return md.replace(new RegExp(`^\\s*#\\s+${escaped}\\s*\\n+`, 'i'), '');
	}

	$effect(() => {
		const source = markdown;
		const title = post?.title;
		if (!source) {
			renderedHtml = '';
			return;
		}
		(async () => {
			renderedHtml = await renderMarkdown(stripLeadingTitle(source, title), {
				context: { posts: allPosts, blogDirs: data.blogDirs },
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
	<title>{post?.title ?? 'Post'} · {config?.hero_title ?? config?.title ?? 'Raksara'}</title>
	<meta name="description" content={post?.summary ?? config?.description ?? config?.hero_subtitle ?? 'Read this post on Raksara.'} />
	{#if pageMeta}
		<meta property="og:title" content={pageMeta.title} />
		<meta property="og:description" content={pageMeta.description ?? ''} />
		<meta property="og:type" content="article" />
		{#if post?.ogImage?.landscape || pageMeta?.image}
			{@const ogLandscape = post?.ogImage?.landscape ?? pageMeta?.image}
			{@const ogPortrait = post?.ogImage?.portrait}
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
		{#if pageMeta.jsonLd}
			{@html `<script type="application/ld+json">${JSON.stringify(pageMeta.jsonLd)}</script>`}
		{/if}
	{/if}
</svelte:head>

<article
	bind:this={articleEl}
	class:poem-layout={isPoem}
	class:novel-layout={isNovel}
	class:reading-mode={readingMode}
	class:comic-layout={isComic}
	class:comic-page-mode={isComic && comicScrollMode === 'page'}
>
	<!-- BL-009 / BL-010: top bar with reading mode + comic mode toggles -->
	<div class="article-top-bar">
		<nav class="breadcrumbs post-breadcrumbs" aria-label="Breadcrumb">
			{#if compactIsDeep}
				<a href={compactBreadcrumbs[0]?.href ?? '/blog'} class="breadcrumb-up">{compactBreadcrumbs[0]?.title ?? '../'}</a>
				<a href={compactBreadcrumbs[1]?.href ?? '/blog'}>{compactBreadcrumbs[1]?.title ?? ''}</a>
				<span class="breadcrumb-sep">/</span>
				<span class="breadcrumb-current">{compactBreadcrumbs[2]?.title ?? post?.title ?? ''}</span>
			{:else}
				{#each compactBreadcrumbs as crumb, idx}
					{#if idx > 0}<span class="breadcrumb-sep">/</span>{/if}
					{#if crumb.current}
						<span class="breadcrumb-current">{crumb.title}</span>
					{:else if crumb.href}
						<a href={crumb.href} class:breadcrumb-up={crumb.title === '../'}>{crumb.title}</a>
					{/if}
				{/each}
			{/if}
		</nav>
		<div class="article-actions">
			{#if isComic}
				<button onclick={toggleComicMode} class="reading-mode-btn">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 2v12" stroke="currentColor" stroke-width="1.3"/></svg>
					{comicScrollMode === 'scroll' ? 'Page mode' : 'Scroll mode'}
				</button>
			{/if}
			<button onclick={toggleReadingMode} class="reading-mode-btn" class:active={readingMode} aria-pressed={readingMode}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2.5h7.5A2.5 2.5 0 0113 5v8.5H5.5A2.5 2.5 0 003 11V2.5z" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 5.5h5M5.5 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
				{readingMode ? 'Exit' : 'Read'}
			</button>

			{#if post}
			<ShareCard
				title={post.title}
				summary={post.summary}
				author={post.author ?? config?.author}
				coverUrl={assetUrl(post.cover)}
				tags={post.tags}
				date={post.date}
			/>
			{/if}
		</div>
	</div>

	<header class="article-header" class:poem-header={isPoem}>
		<h1>{post?.title ?? ''}</h1>
		<div class="article-meta">
			{#if post?.date}
				<time>{formatDate(post.date)}</time>
			{/if}
			{#if post?.status}
				<span class="status-chip status-{post.status}">{post.status}</span>
			{/if}
			{#if post?.category}
				<a href="/category/{post.category}" class="post-card-category">{post.category}</a>
			{/if}
			{#if post?.author}
				<span>{post.author}</span>
			{/if}
			{#each (post?.tags ?? []) as tag}
				<a href="/tag/{tag}" class="tag">{tag}</a>
			{/each}
		</div>
	</header>

	{#if post?.cover}
		{@const coverLqip = buildLqipStyle(post.cover, imageManifest)}
		<div class="article-cover is-loading" class:lqip-shown={!!coverLqip} style={coverLqip}>
			<img {...buildResponsiveAttrs(post.cover, imageManifest, { sizes: articleCoverSizes })} alt={post.title} />
		</div>
	{/if}

	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="article-body" class:poem-body={isPoem} class:novel-body={isNovel}>{@html renderedHtml}</div>
	{:else if !markdown}
		<p style="color: var(--text-secondary);">Post not found.</p>
	{:else}
		<p style="color: var(--text-tertiary);">Loading…</p>
	{/if}

	<!-- Chapter navigation (series) -->
	{#if chapterPrevNav || chapterNextNav}
		<nav class="post-nav" aria-label="Chapter navigation">
			{#if chapterPrevNav}
				<a href={chapterPrevNav.href} class="post-nav-link">
					<span class="post-nav-label">← Previous</span>
					<span class="post-nav-title">{chapterPrevNav.title}</span>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if chapterNextNav}
				<a href={chapterNextNav.href} class="post-nav-link next">
					<span class="post-nav-label">Next →</span>
					<span class="post-nav-title">{chapterNextNav.title}</span>
				</a>
			{/if}
		</nav>
	{/if}

	<!-- Giscus comments -->
	{#if showGiscus && giscusConfig}
		<Giscus
			repo={giscusConfig.repo}
			repoId={giscusConfig.repoId}
			category={giscusConfig.category}
			categoryId={giscusConfig.categoryId}
			term={post?.slug}
			mapping="specific"
			theme="dark_dimmed"
		/>
	{/if}
</article>
<ContentFooter author={config?.author} />

<style>
	.poem-layout :global(.article-body p) {
		text-align: center;
		font-style: italic;
		line-height: 2;
	}
	.novel-layout :global(.article-body) {
		font-size: 1.1rem;
		line-height: 1.85;
	}
	/* BL-009: reading mode */
	.reading-mode {
		max-width: 65ch;
	}
	.reading-mode :global(.article-body) {
		font-size: 1.125rem;
		line-height: 1.9;
	}
	.article-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.post-breadcrumbs {
		min-width: 0;
		flex: 1;
		margin: 0;
	}
	.post-breadcrumbs .breadcrumb-up {
		font-family: var(--font-mono);
	}
	.post-breadcrumbs .breadcrumb-current {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.article-actions {
			margin-left: auto;
		}
	}
	/* BL-010: comic layout */
	.comic-layout :global(.article-body img) {
		display: block;
		width: 100%;
		max-width: 800px;
		margin-inline: auto;
		border-radius: 0.5rem;
	}
	.comic-page-mode :global(.article-body img) {
		max-height: 90vh;
		object-fit: contain;
		scroll-snap-align: start;
	}
	.comic-page-mode :global(.article-body) {
		scroll-snap-type: y mandatory;
		overflow-y: scroll;
		max-height: 100vh;
	}
</style>
