<script lang="ts">
	/**
	 * Open Graph and Twitter tags for routes that do not write their own.
	 * The root layout already emits og:type, og:image, and twitter:card for routes
	 * that do not own their social meta, so pass `image` only when the route does own it.
	 */
	let {
		title,
		description,
		url,
		image = '',
		type = 'website',
	}: {
		title: string;
		description: string;
		url: string;
		image?: string;
		type?: string;
	} = $props();
</script>

<svelte:head>
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image}
		<meta property="og:type" content={type} />
		<meta property="og:image" content={image} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content={image} />
	{/if}
</svelte:head>
