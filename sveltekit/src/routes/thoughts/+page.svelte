<script lang="ts">
	import type { PageData } from './$types';
	import type { Thought } from '$lib/types';
	import { formatDate } from '$lib/utils';
	import ShareCard from '$lib/components/ShareCard.svelte';

	let { data }: { data: PageData } = $props();
	const thoughts = $derived(data.thoughts);
	const config = $derived(data.config);

	const pageTitle = 'Shower Thoughts';
	const pageSubtitle = $derived((config as unknown as Record<string, unknown>)?.thoughts_subtitle as string | undefined ?? 'Random ideas that pop in my mind');

	type SortKey = 'latest' | 'oldest' | 'az' | 'za';
	let sortKey = $state<SortKey>('latest');
	let searchQuery = $state('');
	let page = $state(1);
	const PAGE_SIZE = 15;

	const sorted = $derived.by(() => {
		let list = [...(thoughts ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (q) list = list.filter((t: Thought) => t.title.toLowerCase().includes(q) || t.body?.toLowerCase().includes(q));
		switch (sortKey) {
			case 'oldest': return list.sort((a: Thought, b: Thought) => a.date.localeCompare(b.date));
			case 'az':     return list.sort((a: Thought, b: Thought) => a.title.localeCompare(b.title));
			case 'za':     return list.sort((a: Thought, b: Thought) => b.title.localeCompare(a.title));
			default:       return list.sort((a: Thought, b: Thought) => b.date.localeCompare(a.date));
		}
	});

	const visible = $derived(sorted.slice(0, page * PAGE_SIZE));
	const hasMore = $derived(sorted.length > visible.length);
	const ogBase = $derived(String(config?.site_url ?? config?.url ?? '').replace(/\/+$/, ''));

</script>

<svelte:head>
	<title>{pageTitle} · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={pageSubtitle ?? `Read short thoughts on ${config?.hero_title ?? 'Raksara'}.`} />
	<meta property="og:title" content="{pageTitle} · {config?.hero_title ?? 'Raksara'}" />
	<meta property="og:description" content={pageSubtitle ?? ''} />

	<meta property="og:image" content="{ogBase}/og/defaults/thoughts-landscape.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image" content="{ogBase}/og/defaults/thoughts-portrait.jpg" />
	<meta property="og:image:width" content="1080" />
	<meta property="og:image:height" content="1350" />
	<meta name="twitter:image" content="{ogBase}/og/defaults/thoughts-landscape.jpg" />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">{pageTitle}</h1>
		{#if pageSubtitle}
			<p class="page-subtitle">{pageSubtitle}</p>
		{/if}
	</div>
	<ShareCard title={pageTitle} summary={pageSubtitle} author={config?.author} variant="thoughts" pageCount={(thoughts ?? []).length} pageLabel="thought" itemTitles={sorted.slice(0, 4).map((t) => t.title)} />
</div>

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

<ul class="thoughts-list">
	{#each visible as thought (thought.slug)}
		<li class="thought-card">
			<p class="thought-body">{thought.body ?? thought.title}</p>
			<div class="thought-meta">
				{#if thought.body && thought.title}
					<span class="thought-title">{thought.title}</span>
					<span>·</span>
				{/if}
				<span>{formatDate(thought.date)}</span>
				{#each (thought.tags ?? []) as tag}
					<a href="/tag/{tag}" class="tag" style="padding:2px 8px;font-size:11px">{tag}</a>
				{/each}
			</div>
		</li>
	{/each}
</ul>

{#if hasMore}
	<div class="pagination">
		<button
			onclick={() => (page += 1)}
			style="background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 8px 20px; font-size: 13px; cursor: pointer;"
		>
			Load more ({sorted.length - visible.length} remaining)
		</button>
	</div>
{/if}
