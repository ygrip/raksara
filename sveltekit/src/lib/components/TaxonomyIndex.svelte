<script lang="ts">
	/**
	 * Filterable, sortable index of taxonomy terms (tags or categories) with
	 * per-term counts. Query, sort and page live in `?q=` / `?sort=` / `?page=`
	 * so views can be shared; they're applied after mount because pages prerender.
	 */
	import { onMount } from 'svelte';

	import { resolveTaxonomyPageSize } from '$lib/taxonomy.js';
	const SEARCH_DELAY_MS = 150;

	type SortKey = 'popular' | 'az' | 'za' | 'least';
	const SORT_KEYS: SortKey[] = ['popular', 'az', 'za', 'least'];

	interface Props {
		/** [term, count] pairs */
		items: Array<[string, number]>;
		/** Route prefix, e.g. "/tag/" or "/category/" */
		hrefBase: string;
		pageSize?: number;
		kind: 'tag' | 'category';
	}

	let { items, hrefBase, kind, pageSize }: Props = $props();
	const effectivePageSize = $derived(resolveTaxonomyPageSize(pageSize));

	let query = $state('');
	let sortKey = $state<SortKey>('popular');
	let appliedQuery = $state('');
	let requestedPage = $state(1);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const noun = $derived(kind === 'tag' ? 'tags' : 'categories');

	// Sort only when source/order changes, not on every search keystroke.
	const sorted = $derived.by(() => {
		const list = [...items];
		switch (sortKey) {
			case 'az':
				return list.sort((a, b) => a[0].localeCompare(b[0]));
			case 'za':
				return list.sort((a, b) => b[0].localeCompare(a[0]));
			case 'least':
				return list.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
			default:
				return list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
		}
	});

	const searchable = $derived(sorted.map(([term, count]) => ({ term, count, lower: term.toLowerCase() })));
	const normalizedQuery = $derived(appliedQuery.trim().toLowerCase());
	const filtered = $derived(normalizedQuery
		? searchable.filter(({ lower }) => lower.includes(normalizedQuery))
		: searchable);
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / effectivePageSize)));
	const currentPage = $derived(Math.min(requestedPage, pageCount));
	const start = $derived((currentPage - 1) * effectivePageSize);
	const visible = $derived(filtered.slice(start, start + effectivePageSize));

	/** Split a term around the first case-insensitive match for highlighting. */
	function highlight(term: string): [string, string, string] {
		const q = appliedQuery.trim();
		const at = q ? term.toLowerCase().indexOf(q.toLowerCase()) : -1;
		if (at < 0) return [term, '', ''];
		return [term.slice(0, at), term.slice(at, at + q.length), term.slice(at + q.length)];
	}

	function syncUrl() {
		const params = new URLSearchParams(window.location.search);
		const q = query.trim();
		if (q) params.set('q', q);
		else params.delete('q');
		if (sortKey !== 'popular') params.set('sort', sortKey);
		else params.delete('sort');
		if (currentPage > 1) params.set('page', String(currentPage));
		else params.delete('page');
		const search = params.toString();
		window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
	}

	function applySearch() {
		clearTimeout(searchTimer);
		appliedQuery = query;
		requestedPage = 1;
		syncUrl();
	}

	function scheduleSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(applySearch, SEARCH_DELAY_MS);
	}

	function changePage(page: number) {
		requestedPage = Math.max(1, Math.min(page, pageCount));
		syncUrl();
	}

	function clear() {
		query = '';
		applySearch();
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		query = params.get('q') ?? '';
		appliedQuery = query;
		const page = Number(params.get('page') ?? 1);
		requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
		const sort = params.get('sort') as SortKey | null;
		if (sort && SORT_KEYS.includes(sort)) sortKey = sort;
		return () => clearTimeout(searchTimer);
	});
</script>

<div class="dir-controls">
	<div class="dir-search-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
		<input
			id="dir-search"
			type="search"
			bind:value={query}
			oninput={scheduleSearch}
			onkeydown={(event) => event.key === 'Escape' && clear()}
			placeholder="Filter {noun}…"
			class="dir-search-input"
			aria-label="Filter {noun}"
			aria-controls="taxonomy-results"
			autocomplete="off"
			spellcheck="false"
		/>
	</div>
	<div class="dir-sort-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<select id="dir-sort" bind:value={sortKey} onchange={applySearch} class="dir-sort-select" aria-label="Sort {noun}">
			<option value="popular">Most used</option>
			<option value="least">Least used</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

<!-- Only one page is mounted; search still covers every term. -->
<p class="taxonomy-result-count" aria-live="polite">
	{#if appliedQuery.trim()}
		{filtered.length} of {items.length} {noun} match “{appliedQuery.trim()}”.
	{/if}
	{#if filtered.length}
		Showing {start + 1}–{Math.min(start + effectivePageSize, filtered.length)} of {filtered.length} {noun}.
	{/if}
</p>

{#if filtered.length}
	<div class="blog-dir-folders" id="taxonomy-results">
		{#each visible as { term, count } (term)}
			{@const [before, match, after] = highlight(term)}
			<a href="{hrefBase}{term}" class="blog-dir-chip">
				{#if kind === 'tag'}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8.586V3a1 1 0 011-1h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L2.293 9.293A1 1 0 012 8.586z" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>
				{:else}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L8.854 4.145A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>
				{/if}
				<span>{before}{#if match}<mark class="taxonomy-match">{match}</mark>{/if}{after}</span>
				<span class="blog-dir-count">{count}</span>
			</a>
		{/each}
	</div>
{:else}
	<div class="empty-state" id="taxonomy-results">
		<p>No {noun} match “<strong>{appliedQuery.trim()}</strong>”.</p>
		<button type="button" class="home-btn home-btn-secondary taxonomy-clear" onclick={clear}>Clear filter</button>
	</div>
{/if}

{#if pageCount > 1}
	<nav class="taxonomy-pagination" aria-label="{noun} pagination">
		<button type="button" class="home-btn home-btn-secondary" disabled={currentPage === 1} onclick={() => changePage(currentPage - 1)} aria-controls="taxonomy-results">Previous</button>
		<span aria-live="polite">Page {currentPage} of {pageCount}</span>
		<button type="button" class="home-btn home-btn-secondary" disabled={currentPage === pageCount} onclick={() => changePage(currentPage + 1)} aria-controls="taxonomy-results">Next</button>
	</nav>
{/if}

<style>
	.taxonomy-pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-top: 24px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.taxonomy-pagination button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.taxonomy-result-count {
		margin: -6px 0 14px;
		color: var(--text-tertiary);
		font-size: 12.5px;
	}

	.taxonomy-match {
		padding: 0 1px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 28%, transparent);
		color: inherit;
	}

	.taxonomy-clear {
		margin-top: 14px;
	}
</style>
