<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { taxonomyHref } from '$lib/taxonomy.js';
	import TaxonomyShell from '$lib/components/TaxonomyShell.svelte';

	let { data }: { data: PageData } = $props();
	let mounted = $state(false);
	let redirectError = $state('');
	onMount(() => { mounted = true; });
	$effect(() => {
		if (!mounted || data.archive) return;
		const target = new URL(taxonomyHref('category', data.cat, data.config), $page.url.origin);
		const requestedPage = $page.url.searchParams.get('page');
		if (requestedPage) target.searchParams.set('page', requestedPage);
		target.hash = $page.url.hash;
		let active = true;
		void goto(`${target.pathname}${target.search}${target.hash}`, { replaceState: true }).catch(error => {
			if (active) redirectError = error instanceof Error ? error.message : 'Unable to open this archive.';
		});
		return () => { active = false; };
	});
</script>

<svelte:head>
	{#if !data.archive}<title>Category archive · {data.config.hero_title ?? 'Raksara'}</title>{/if}
</svelte:head>

{#if data.archive}
	<TaxonomyShell kind="category" config={data.config} fixedTerm={data.cat} initialArchive={data.archive} initialIndex={data.taxonomyIndex} />
{:else}
	<h1 class="page-title">Category archive</h1>
	{#if redirectError}<p role="alert">{redirectError}</p>{:else}<p role="status">Opening archive…</p>{/if}
	<p><a href={taxonomyHref('category', data.cat, data.config)}>Continue to {data.cat}</a></p>
{/if}
