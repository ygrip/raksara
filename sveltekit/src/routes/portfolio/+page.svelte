<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { PortfolioItem } from '$lib/types';
	import { formatDate } from '$lib/utils';
	import ShareCard from '$lib/components/ShareCard.svelte';

	let { data }: { data: PageData } = $props();
	const portfolio = $derived(data.portfolio);
	const config = $derived(data.config);

	type SortKey = 'latest' | 'oldest' | 'az' | 'za';
	let sortKey = $state<SortKey>('latest');
	let searchQuery = $state('');

	function portfolioHref(slug: string): string {
		return `/portfolio/${slug}/`;
	}

	function openPortfolio(event: MouseEvent, slug: string) {
		if (event.target instanceof Element && event.target.closest('a, button')) return;
		goto(portfolioHref(slug));
	}

	function openPortfolioFromKey(event: KeyboardEvent, slug: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		goto(portfolioHref(slug));
	}

	const sorted = $derived.by(() => {
		let list = [...(portfolio ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (q) list = list.filter((i) => i.title.toLowerCase().includes(q) || i.summary?.toLowerCase().includes(q));
		switch (sortKey) {
			case 'az':     return list.sort((a, b) => a.title.localeCompare(b.title));
			case 'za':     return list.sort((a, b) => b.title.localeCompare(a.title));
			case 'oldest': return list.sort((a: PortfolioItem, b: PortfolioItem) => (a.date ?? '').localeCompare(b.date ?? ''));
			default:       return list.sort((a: PortfolioItem, b: PortfolioItem) => (b.date ?? '').localeCompare(a.date ?? ''));
		}
	});

	// BL-008: group by year when sorting by date, group by letter when sorting A-Z/Z-A
	type Group = { label: string; items: PortfolioItem[] };
	const grouped = $derived.by((): Group[] => {
		if (!sorted.length) return [];
		if (sortKey === 'az' || sortKey === 'za') {
			const map = new Map<string, PortfolioItem[]>();
			for (const item of sorted) {
				const letter = item.title[0]?.toUpperCase() ?? '#';
				if (!map.has(letter)) map.set(letter, []);
				map.get(letter)!.push(item);
			}
			return [...map.entries()].map(([label, items]) => ({ label, items }));
		} else {
			const map = new Map<string, PortfolioItem[]>();
			for (const item of sorted) {
				const year = item.date ? item.date.slice(0, 4) : 'Unknown';
				if (!map.has(year)) map.set(year, []);
				map.get(year)!.push(item);
			}
			return [...map.entries()].map(([label, items]) => ({ label, items }));
		}
	});
</script>

<svelte:head>
	<title>Portfolio · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Explore ${(portfolio ?? []).length} projects in the ${config?.hero_title ?? 'Raksara'} portfolio.`} />
</svelte:head>

<!-- Page header -->
<div class="page-header">
	<div>
		<h1 class="page-title">Portfolio</h1>
		<p class="page-subtitle">{(portfolio ?? []).length} project{(portfolio ?? []).length !== 1 ? 's' : ''}</p>
	</div>
	<ShareCard title="Portfolio" author={config?.author} variant="directory" pageCount={(portfolio ?? []).length} pageLabel="project" itemTitles={sorted.slice(0, 4).map((p) => p.title)} />
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
		/>
	</div>
	<div class="dir-sort-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<select
			id="dir-sort"
			bind:value={sortKey}
			class="dir-sort-select"
			aria-label="Sort listing"
		>
			<option value="latest">Latest</option>
			<option value="oldest">Oldest</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

{#if sorted.length === 0}
	<p class="italic" style="color: var(--text-tertiary);">No projects match your search.</p>
{/if}

<div class="timeline">
	{#each grouped as group}
		<div class="timeline-year">
			<div class="timeline-year-label">{group.label}</div>
			{#each group.items as item}
				<div class="timeline-item">
					<div
						class="portfolio-card"
						role="link"
						tabindex="0"
						onclick={(event) => openPortfolio(event, item.slug)}
						onkeydown={(event) => openPortfolioFromKey(event, item.slug)}
					>
						<div class="portfolio-card-title">
							<a href={portfolioHref(item.slug)} style="color:inherit;text-decoration:none;">{item.title}</a>
						</div>
						{#if item.summary}
							<div class="portfolio-card-summary">{item.summary}</div>
						{/if}
						{#if item.status}
							<div class="portfolio-card-meta-row">
								<span class="status-chip status-{item.status}">{item.status}</span>
							</div>
						{/if}
						{#if item.tags?.length}
							<div class="portfolio-card-tags">
								{#each item.tags.slice(0, 5) as tag}
									<span class="tag" style="padding:3px 10px;font-size:11px">{tag}</span>
								{/each}
							</div>
						{/if}
						{#if item.github || item.demo}
							<div class="portfolio-card-links">
								{#if item.github}
									<a href={item.github} target="_blank" rel="noopener" class="btn-github" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
										<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
										GitHub
									</a>
								{/if}
								{#if item.demo}
									<a href={item.demo} target="_blank" rel="noopener" class="btn-demo" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
										<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
										Demo
									</a>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>
