<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Post } from '$lib/types';
	import { formatDate, humanize } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import ShareCard from '$lib/components/ShareCard.svelte';

	let { data }: { data: PageData } = $props();
	const dirPath = $derived(data.dirPath);
	const posts = $derived(data.posts);
	const subdirs = $derived(data.subdirs);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const postThumbSizes = '(max-width: 480px) 100px, (max-width: 640px) 120px, 180px';

	function postHref(slug: string): string {
		return `/blog/post/${slug}/`;
	}

	function openPostCard(event: MouseEvent, slug: string) {
		if (event.target instanceof Element && event.target.closest('a, button')) return;
		goto(postHref(slug));
	}

	function openPostCardFromKey(event: KeyboardEvent, slug: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		goto(postHref(slug));
	}

	const MAX_CRUMBS = 3;
	const allCrumbs = $derived(dirPath ? ['blog', ...dirPath.split('/').filter(Boolean)] : ['blog']);
	let crumbsExpanded = $state(false);
	const crumbs = $derived(
		allCrumbs.length > MAX_CRUMBS && !crumbsExpanded
			? [allCrumbs[0], null, ...allCrumbs.slice(-2)]
			: allCrumbs
	);

	let searchQuery = $state('');
	type SortKey = 'latest' | 'oldest' | 'az' | 'za';
	let sortKey = $state<SortKey>('latest');

	const sortedPosts = $derived.by(() => {
		let list = [...(posts ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter((p) => p.title.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q));
		}
		switch (sortKey) {
			case 'az':
				return list.sort((a: Post, b: Post) => a.title.localeCompare(b.title));
			case 'za':
				return list.sort((a: Post, b: Post) => b.title.localeCompare(a.title));
			case 'oldest':
				return list.sort((a: Post, b: Post) => a.date.localeCompare(b.date));
			default:
				return list.sort((a: Post, b: Post) => b.date.localeCompare(a.date));
		}
	});
</script>

<svelte:head>
	<title>{humanize(dirPath?.split('/').pop() ?? 'Blog')} · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Explore ${(posts ?? []).length} posts in ${humanize(dirPath?.split('/').pop() ?? 'Blog')} on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<nav class="breadcrumbs" aria-label="breadcrumb">
	{#each crumbs as crumb, i}
		{#if crumb === null}
			<span class="breadcrumb-sep">/</span>
			<button class="breadcrumb-ellipsis" onclick={() => (crumbsExpanded = true)} aria-label="Show full breadcrumb">…</button>
		{:else}
			{#if i > 0}<span class="breadcrumb-sep">/</span>{/if}
			{#if i === crumbs.length - 1}
				<span class="breadcrumb-current">{humanize(crumb)}</span>
			{:else}
				<a href={crumb === 'blog' ? '/blog' : `/blog/dir/${allCrumbs.slice(1, allCrumbs.indexOf(crumb) + 1).join('/')}`}>{humanize(crumb)}</a>
			{/if}
		{/if}
	{/each}
</nav>

<div class="page-header">
	<div>
		<h1 class="page-title">{humanize(dirPath?.split('/').pop() ?? 'Blog')}</h1>
		<p class="page-subtitle">{(posts ?? []).length} post{(posts ?? []).length !== 1 ? 's' : ''}</p>
	</div>
	<ShareCard title={humanize(dirPath?.split('/').pop() ?? 'Blog')} author={config?.author} variant="directory" pageCount={(posts ?? []).length} pageLabel="post" itemTitles={sortedPosts.slice(0, 4).map((p) => p.title)} />
</div>

{#if subdirs.length}
	<div class="blog-dir-folders">
		{#each subdirs as sub}
			<a href="/blog/dir/{sub.path}" class="blog-dir-chip">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5.5A1.5 1.5 0 013.5 4h3.086a1.5 1.5 0 011.06.44l.854.853A.5.5 0 008.854 5.5H12.5A1.5 1.5 0 0114 7v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V5.5z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
				{humanize(sub.name)}
				<span class="blog-dir-count">{sub.count}</span>
			</a>
		{/each}
	</div>
{/if}

<div class="dir-controls">
	<div class="dir-search-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
		<input type="search" bind:value={searchQuery} placeholder="Search here…" class="dir-search-input" aria-label="Search current listing" />
	</div>
	<div class="dir-sort-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<select bind:value={sortKey} class="dir-sort-select" aria-label="Sort listing">
			<option value="latest">Latest</option>
			<option value="oldest">Oldest</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

<div class="post-list">
	{#each sortedPosts as post (post.slug)}
		<div
			class="post-card{post.cover ? ' has-thumb' : ''}"
			role="link"
			tabindex="0"
			onclick={(event) => openPostCard(event, post.slug)}
			onkeydown={(event) => openPostCardFromKey(event, post.slug)}
		>
			{#if post.cover}
				{@const postThumbLqip = buildLqipStyle(post.cover, imageManifest)}
				<div class="post-card-thumb is-loading" class:lqip-shown={!!postThumbLqip} style={postThumbLqip}>
					<img {...buildResponsiveAttrs(post.cover, imageManifest, { sizes: postThumbSizes, maxWidth: 640 })} alt={post.title} />
				</div>
			{/if}
			<div class="post-card-body">
				<div class="post-card-title"><a href={postHref(post.slug)} style="color:inherit;text-decoration:none;">{post.title}</a></div>
				{#if post.status}
					<span class="status-chip status-{post.status}">{post.status}</span>
				{/if}
				{#if post.summary}
					<div class="post-card-summary">{post.summary}</div>
				{/if}
				<div class="post-card-meta">
					<span class="post-card-date">{formatDate(post.date)}</span>
					{#if post.category}
						<a href="/category/{post.category}" class="post-card-category">{post.category}</a>
					{/if}
					{#each (post.tags ?? []).slice(0, 3) as tag}
						<a href="/tag/{tag}" class="tag" style="padding:2px 8px;font-size:11px">{tag}</a>
					{/each}
				</div>
			</div>
		</div>
	{/each}
	{#if sortedPosts.length === 0}
		<div class="empty-state"><p>No posts found.</p></div>
	{/if}
</div>
