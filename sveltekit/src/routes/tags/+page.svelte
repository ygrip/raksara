<script lang="ts">
	import type { PageData } from './$types';
	import TaxonomyIndex from '$lib/components/TaxonomyIndex.svelte';
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

<TaxonomyIndex items={tags} hrefBase="/tag/" kind="tag" pageSize={config?.taxonomy_page_size} />
