<script lang="ts">
	import type { PageData } from './$types';
	import TaxonomyIndex from '$lib/components/TaxonomyIndex.svelte';
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

<TaxonomyIndex items={categories} hrefBase="/category/" kind="category" />
