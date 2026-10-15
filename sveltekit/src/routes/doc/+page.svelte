<script lang="ts">
	let { data }: { data: { docs?: Array<{ title: string; slug: string; summary?: string; icon?: string; status?: string }>; config?: { hero_title?: string } } } = $props();
	const docs = $derived(data.docs ?? []);
	const config = $derived(data.config);
	let query = $state('');
	const filteredDocs = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return docs;
		return docs.filter((doc) => `${doc.title} ${doc.summary ?? ''}`.toLowerCase().includes(q));
	});
</script>

<svelte:head>
	<title>Documentation · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Browse ${docs.length} documentation pages on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">Documentation</h1>
		<p class="page-subtitle">{docs.length} component{docs.length !== 1 ? 's' : ''}</p>
	</div>
</div>

{#if docs.length}
	<div class="component-list-wrap">
		<div class="component-list-search-wrap">
			<svg class="component-list-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5" stroke-linecap="round"/></svg>
			<input class="component-list-search" type="search" bind:value={query} placeholder="Find a component..." aria-label="Filter components" />
			{#if query.trim()}<span class="component-list-filter-count" aria-live="polite">{filteredDocs.length} of {docs.length}</span>{/if}
		</div>
		<div class="component-list">
			{#each filteredDocs as doc (doc.slug)}
				<a href="/{doc.slug}" class="component-card">
					<div class="component-card-kicker">
						<span class="component-card-index" aria-hidden="true">{String(docs.indexOf(doc) + 1).padStart(2, '0')}</span>
						{#if doc.status && doc.status.toLowerCase() !== "available"}<span class="component-card-status status-{doc.status.toLowerCase()}">{doc.status}</span>{/if}
					</div>
					<div class="component-card-header"><h3 class="component-card-title">{doc.title}</h3></div>
					{#if doc.summary}<p class="component-card-desc">{doc.summary}</p>{/if}
					<span class="component-card-arrow" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>
				</a>
			{/each}
			{#if filteredDocs.length === 0}
				<p class="component-list-empty">No components match your search.</p>
			{/if}
		</div>
	</div>
{:else}
	<div class="empty-state"><p>No doc entries found.</p></div>
{/if}
