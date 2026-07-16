<script lang="ts">
	import { onMount, tick } from 'svelte';

	interface Props {
		hasMore: boolean;
		onLoadMore: () => void | Promise<void>;
		remaining?: number;
		rootMargin?: string;
	}

	let {
		hasMore,
		onLoadMore,
		remaining = 0,
		rootMargin = '600px 0px',
	}: Props = $props();

	let sentinel: HTMLDivElement;
	let observer: IntersectionObserver | null = null;
	let loading = $state(false);
	let observerSupported = $state(true);

	async function loadNextBatch() {
		if (!hasMore || loading) return;

		loading = true;
		try {
			await onLoadMore();
			await tick();
		} finally {
			loading = false;
		}
	}

	function observeSentinel() {
		if (!observer || !sentinel?.isConnected) return;
		observer.unobserve(sentinel);
		if (hasMore) observer.observe(sentinel);
	}

	onMount(() => {
		if (!('IntersectionObserver' in window)) {
			observerSupported = false;
			return;
		}

		observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting || loading || !hasMore) return;

				void loadNextBatch().then(() => {
					requestAnimationFrame(observeSentinel);
				});
			},
			{ rootMargin, threshold: 0.01 },
		);

		observeSentinel();
		return () => {
			observer?.disconnect();
			observer = null;
		};
	});

	// Search, sorting, and filtering can turn hasMore back on after the list
	// previously reached its end. Re-observe so the sentinel does not remain inert.
	$effect(() => {
		hasMore;
		remaining;
		if (!observer) return;
		requestAnimationFrame(observeSentinel);
	});
</script>

<div
	bind:this={sentinel}
	class="infinite-scroll-sentinel"
	aria-live="polite"
	aria-busy={loading}
>
	{#if hasMore}
		{#if observerSupported}
			{#if loading}
				<span class="infinite-scroll-spinner" aria-hidden="true"></span>
				<span>Loading more…</span>
			{:else}
				<span class="infinite-scroll-hint">
					{remaining > 0 ? `${remaining} more item${remaining === 1 ? '' : 's'}` : 'More items available'}
				</span>
			{/if}
		{:else}
			<button type="button" class="infinite-scroll-fallback" onclick={loadNextBatch}>
				Load more{remaining > 0 ? ` (${remaining} remaining)` : ''}
			</button>
		{/if}
	{:else}
		<span class="infinite-scroll-end">You’ve reached the end.</span>
	{/if}
</div>

<style>
	.infinite-scroll-sentinel {
		min-height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		padding: 1rem;
		color: var(--text-tertiary);
		font-size: 0.8rem;
		text-align: center;
	}

	.infinite-scroll-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 999px;
		animation: infinite-scroll-spin 0.7s linear infinite;
	}

	.infinite-scroll-hint {
		opacity: 0.7;
	}

	.infinite-scroll-end {
		opacity: 0.65;
	}

	.infinite-scroll-fallback {
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-sm);
		background: var(--accent-subtle);
		color: var(--accent);
		padding: 0.5rem 1rem;
		font: inherit;
		cursor: pointer;
	}

	.infinite-scroll-fallback:hover,
	.infinite-scroll-fallback:focus-visible {
		border-color: var(--accent);
		background: var(--bg-hover);
	}

	@keyframes infinite-scroll-spin {
		to { transform: rotate(360deg); }
	}

	@media (prefers-reduced-motion: reduce) {
		.infinite-scroll-spinner {
			animation: none;
		}
	}
</style>
