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
			<input class="component-list-search" type="search" bind:value={query} placeholder="Filter components..." aria-label="Filter components" />
		</div>
		<div class="component-list">
			{#each filteredDocs as doc}
				<a href="/{doc.slug}" class="component-card">
					<div class="component-card-header">
						{#if doc.icon}<span class="component-card-icon">{doc.icon}</span>{/if}
						<h3 class="component-card-title">{doc.title}</h3>
						{#if doc.status}<span class="component-card-status status-{doc.status.toLowerCase()}">{doc.status}</span>{/if}
					</div>
					{#if doc.summary}
						<p class="component-card-desc">{doc.summary}</p>
					{/if}
					<div class="component-card-footer">
						<span class="component-card-link">See detail →</span>
					</div>
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
