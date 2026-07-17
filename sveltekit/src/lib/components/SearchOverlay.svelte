<script lang="ts">
	/**
	 * SearchOverlay — MiniSearch-powered search modal.
	 * Mirrors the legacy 13-search.js behaviour.
	 * Lazy-loads search-index.json and miniSearch on first open.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { metadataUrl } from '$lib/metadata';
	import AgenticTools from '$lib/components/AgenticTools.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let results = $state<Array<{ title: string; section: string; category?: string; href: string }>>([]);
	let loading = $state(false);
	let placeholder = $state('Search posts, projects, pages…');

	let miniSearch: unknown = null;
	let loadPromise: Promise<void> | null = null;

	// Animated placeholder phrases
	const phrases = ['Search posts…', 'Search projects…', 'Search thoughts…', 'Search tags…'];
	let phraseIdx = 0;
	let phraseCharIdx = 0;
	let phraseDir = 1;
	let phraseTimer: ReturnType<typeof setTimeout> | null = null;

	function animatePlaceholder() {
		if (!open || query.length > 0) return;
		const phrase = phrases[phraseIdx];
		if (phraseDir === 1) {
			phraseCharIdx++;
			if (phraseCharIdx > phrase.length) {
				phraseDir = -1;
				phraseTimer = setTimeout(animatePlaceholder, 2000);
				return;
			}
		} else {
			phraseCharIdx--;
			if (phraseCharIdx < 0) {
				phraseDir = 1;
				phraseIdx = (phraseIdx + 1) % phrases.length;
				phraseCharIdx = 0;
				phraseTimer = setTimeout(animatePlaceholder, 400);
				return;
			}
		}
		placeholder = phrase.slice(0, phraseCharIdx);
		phraseTimer = setTimeout(animatePlaceholder, phraseDir === 1 ? 80 : 40);
	}

	function startPlaceholderAnimation() {
		if (phraseTimer) clearTimeout(phraseTimer);
		phraseIdx = 0;
		phraseCharIdx = 0;
		phraseDir = 1;
		placeholder = '';
		animatePlaceholder();
	}

	function stopPlaceholderAnimation() {
		if (phraseTimer) { clearTimeout(phraseTimer); phraseTimer = null; }
		placeholder = 'Search posts, projects, pages…';
	}

	async function ensureSearchReady() {
		if (miniSearch) return;
		if (loadPromise) return loadPromise;
		loading = true;
		placeholder = 'Loading search index…';
		loadPromise = (async () => {
			try {
				const [{ default: MiniSearch }, res] = await Promise.all([
					import('minisearch'),
					fetch(metadataUrl('search-index.json')),
				] as const);
				if (!res.ok) throw new Error('Failed to load search index');
				const serialized = await res.json();
				miniSearch = MiniSearch.loadJSON(JSON.stringify(serialized), {
					fields: ['title', 'body', 'tags', 'category'],
					storeFields: ['title', 'slug', 'section', 'category'],
				});
			} catch (err) {
				console.warn('[search] init failed:', err);
				placeholder = 'Search unavailable right now';
			} finally {
				loading = false;
			}
		})();
		return loadPromise;
	}

	$effect(() => {
		if (open) {
			ensureSearchReady().then(() => {
				setTimeout(() => inputEl?.focus(), 50);
				startPlaceholderAnimation();
			});
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
			query = '';
			results = [];
			stopPlaceholderAnimation();
		}
	});

	let debounce: ReturnType<typeof setTimeout> | null = null;
	function handleInput() {
		if (debounce) clearTimeout(debounce);
		if (!query) {
			results = [];
			startPlaceholderAnimation();
			return;
		}
		stopPlaceholderAnimation();
		debounce = setTimeout(() => {
			if (!miniSearch || query.length < 2) { results = []; return; }
			type Hit = { title: string; slug: string; section: string; category?: string };
			const hits = (miniSearch as { search: (q: string, o: object) => Hit[] }).search(query, {
				limit: 10,
			});
			results = hits.map((h) => {
				let href = '/';
				if (h.section === 'blog') href = `/blog/post/${h.slug}`;
				else if (h.section === 'portfolio') href = `/portfolio/${h.slug}`;
				else if (h.section === 'pages') href = `/${h.slug}`;
				else if (h.section === 'gallery') href = '/gallery';
				else if (h.section === 'thoughts') href = '/thoughts';
				return { title: h.title, section: h.section, category: h.category, href };
			});
		}, 150);
	}

	function handleResultClick(href: string) {
		open = false;
		goto(href);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	onMount(() => {
		function globalKeydown(e: KeyboardEvent) {
			if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName ?? '')) {
				e.preventDefault();
				open = true;
			}
		}
		window.addEventListener('keydown', globalKeydown);
		return () => window.removeEventListener('keydown', globalKeydown);
	});
</script>

<AgenticTools />

{#if open}
	<div class="search-overlay" role="dialog" aria-modal="true" aria-label="Search" tabindex="0" onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="search-overlay-backdrop" onclick={() => (open = false)}></div>

		<div class="search-overlay-content glass-heavy">
			<div class="search-overlay-header">
				<svg width="18" height="18" viewBox="0 0 16 16" fill="none" style="flex-shrink:0">
					<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
					<path d="M10 10l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
				</svg>
				<input bind:this={inputEl} bind:value={query} oninput={handleInput} {placeholder} id="search-overlay-input" type="search" autocomplete="off" aria-label="Search" />
				{#if loading}
					<span class="search-kbd">Loading…</span>
				{/if}
				<button type="button" class="search-kbd" onclick={() => (open = false)}>Esc</button>
			</div>

			<div class="search-overlay-results">
				{#if results.length}
					{#each results as r}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<button type="button" class="search-result-item" onclick={() => handleResultClick(r.href)}>
							<div class="search-result-title">{r.title}</div>
							<div class="search-result-meta">{r.section}{r.category ? ` · ${r.category}` : ''}</div>
						</button>
					{/each}
				{:else if query.length >= 2}
					<div class="search-empty">No results for "<em>{query}</em>"</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
