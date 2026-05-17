<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const tags = $derived(data.tags);
	const config = $derived(data.config);
</script>

<svelte:head>
	<title>Tags · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Browse ${tags.length} tags on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">Tags</h1>
		<p class="page-subtitle">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
	</div>
</div>

<div class="blog-dir-folders">
	{#each tags as [tag, count]}
		<a href="/tag/{tag}" class="blog-dir-chip">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8.586V3a1 1 0 011-1h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L2.293 9.293A1 1 0 012 8.586z" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>
			{tag}
			<span class="blog-dir-count">{count}</span>
		</a>
	{/each}
</div>
