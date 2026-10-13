<script lang="ts">
	import type { PageData } from './$types';
	import TaxonomyShell from '$lib/components/TaxonomyShell.svelte';
	let { data }: { data: PageData } = $props();
</script>

<TaxonomyShell kind="category" config={data.config} />
