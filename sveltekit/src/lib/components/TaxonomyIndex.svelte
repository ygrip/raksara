<script lang="ts">
	/**
	 * Filterable, sortable index of taxonomy terms (tags or categories) with
	 * per-term counts. The query and sort live in `?q=` / `?sort=` so a filtered
	 * view can be shared; they're applied after mount because pages prerender.
	 */
	import { onMount } from 'svelte';

	type SortKey = 'popular' | 'az' | 'za' | 'least';
	const SORT_KEYS: SortKey[] = ['popular', 'az', 'za', 'least'];

	interface Props {
		/** [term, count] pairs */
		items: Array<[string, number]>;
		/** Route prefix, e.g. "/tag/" or "/category/" */
		hrefBase: string;
		kind: 'tag' | 'category';
	}

	let { items, hrefBase, kind }: Props = $props();

	let query = $state('');
	let sortKey = $state<SortKey>('popular');

	const noun = $derived(kind === 'tag' ? 'tags' : 'categories');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = q ? items.filter(([term]) => term.toLowerCase().includes(q)) : [...items];
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

	/** Split a term around the first case-insensitive match for highlighting. */
	function highlight(term: string): [string, string, string] {
		const q = query.trim();
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
		const search = params.toString();
		window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
	}

	function clear() {
		query = '';
		syncUrl();
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		query = params.get('q') ?? '';
		const sort = params.get('sort') as SortKey | null;
		if (sort && SORT_KEYS.includes(sort)) sortKey = sort;
	});
</script>

<div class="dir-controls">
	<div class="dir-search-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
		<input
			id="dir-search"
			type="search"
			bind:value={query}
			oninput={syncUrl}
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
		<select id="dir-sort" bind:value={sortKey} onchange={syncUrl} class="dir-sort-select" aria-label="Sort {noun}">
			<option value="popular">Most used</option>
			<option value="least">Least used</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

<!-- Total count lives in the page header; announce matches only while filtering. -->
<p class="taxonomy-result-count" aria-live="polite">
	{#if query.trim()}
		{filtered.length} of {items.length} {noun} match “{query.trim()}”
	{/if}
</p>

{#if filtered.length}
	<div class="blog-dir-folders" id="taxonomy-results">
		{#each filtered as [term, count] (term)}
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
		<p>No {noun} match “<strong>{query.trim()}</strong>”.</p>
		<button type="button" class="home-btn home-btn-secondary taxonomy-clear" onclick={clear}>Clear filter</button>
	</div>
{/if}

<style>
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
