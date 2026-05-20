<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Post } from '$lib/types';
	import { formatDate, humanize } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import ShareCard from '$lib/components/ShareCard.svelte';

	let { data }: { data: PageData } = $props();
	const posts = $derived(data.posts);
	const blogDirs = $derived(data.blogDirs);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const rootPosts = $derived((posts ?? []).filter((p) => !p.dir || p.dir === ''));
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

	// Subdirectories at root level
	const rootSubdirs = $derived(
		Object.keys(blogDirs ?? {})
			.filter((k) => k !== '' && !k.includes('/'))
			.sort()
	);

	type SortKey = 'latest' | 'oldest' | 'az' | 'za';
	let sortKey = $state<SortKey>('latest');
	let searchQuery = $state('');
	let page = $state(1);
	const PAGE_SIZE = 10;

	const sorted = $derived.by(() => {
		let list = [...(rootPosts ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (q) list = list.filter((p: Post) => p.title.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q));
		switch (sortKey) {
			case 'oldest': return list.sort((a: Post, b: Post) => a.date.localeCompare(b.date));
			case 'az':     return list.sort((a: Post, b: Post) => a.title.localeCompare(b.title));
			case 'za':     return list.sort((a: Post, b: Post) => b.title.localeCompare(a.title));
			default:       return list.sort((a: Post, b: Post) => b.date.localeCompare(a.date));
		}
	});

	const visible = $derived(sorted.slice(0, page * PAGE_SIZE));
	const hasMore = $derived(sorted.length > visible.length);

</script>

<svelte:head>
	<title>Blog · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Browse ${(rootPosts ?? []).length} blog posts on ${config?.hero_title ?? 'Raksara'}.`} />
	<meta property="og:title" content="Blog · {config?.hero_title ?? 'Raksara'}" />
	<meta property="og:description" content={`Browse ${(rootPosts ?? []).length} blog posts on ${config?.hero_title ?? 'Raksara'}.`} />
	{@const _ogBase = String(config?.site_url ?? config?.url ?? '').replace(/\/+$/, '')}
	<meta property="og:image" content="{_ogBase}/og/defaults/blog-landscape.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image" content="{_ogBase}/og/defaults/blog-portrait.jpg" />
	<meta property="og:image:width" content="1080" />
	<meta property="og:image:height" content="1350" />
	<meta name="twitter:image" content="{_ogBase}/og/defaults/blog-landscape.jpg" />
</svelte:head>

<!-- Page header -->
<div class="page-header">
	<div>
		<h1 class="page-title">Blog</h1>
		<p class="page-subtitle">{(rootPosts ?? []).length} post{(rootPosts ?? []).length !== 1 ? 's' : ''}</p>
	</div>
	<ShareCard title="Blog" author={config?.author} variant="directory" pageCount={(rootPosts ?? []).length} pageLabel="post" itemTitles={sorted.slice(0, 4).map((p) => p.title)} />
</div>

<!-- Search + Sort controls -->
<div class="dir-controls">
	<div class="dir-search-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
		<input
			id="dir-search"
			type="search"
			bind:value={searchQuery}
			placeholder="Search here…"
			class="dir-search-input"
			aria-label="Search current listing"
			oninput={() => (page = 1)}
		/>
	</div>
	<div class="dir-sort-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<select
			id="dir-sort"
			bind:value={sortKey}
			class="dir-sort-select"
			aria-label="Sort listing"
			onchange={() => (page = 1)}
		>
			<option value="latest">Latest</option>
			<option value="oldest">Oldest</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

<!-- Subdirectory chips -->
{#if rootSubdirs.length}
	<div class="blog-dir-folders">
		{#each rootSubdirs as dir}
			{@const count = ((blogDirs as Record<string, { posts?: unknown[] }>)[dir]?.posts?.length ?? 0)}
			<a href="/blog/dir/{dir}" class="blog-dir-chip">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5.5A1.5 1.5 0 013.5 4h3.086a1.5 1.5 0 011.06.44l.854.853A.5.5 0 008.854 5.5H12.5A1.5 1.5 0 0114 7v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V5.5z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
				{humanize(dir)}
				<span class="blog-dir-count">{count}</span>
			</a>
		{/each}
	</div>
{/if}

<!-- Post list -->
<div class="post-list">
	{#each visible as post (post.slug)}
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
</div>

{#if hasMore}
	<div class="pagination">
		<button
			onclick={() => (page += 1)}
			class="load-more-btn"
			style="background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 8px 20px; font-size: 13px; cursor: pointer;"
		>
			Load more ({sorted.length - visible.length} remaining)
		</button>
	</div>
{/if}
