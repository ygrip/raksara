<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const categories = $derived(data.categories);
	const config = $derived(data.config);
</script>

<svelte:head>
	<title>Categories · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Browse ${categories.length} content categories on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">Categories</h1>
		<p class="page-subtitle">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</p>
	</div>
</div>

<div class="blog-dir-folders">
	{#each categories as [cat, count]}
		<a href="/category/{cat}" class="blog-dir-chip">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L8.854 4.145A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>
			{cat}
			<span class="blog-dir-count">{count}</span>
		</a>
	{/each}
</div>
