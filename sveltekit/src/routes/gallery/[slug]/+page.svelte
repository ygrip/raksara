<script lang="ts">
	import GalleryPage from '../+page.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<GalleryPage {data} />
