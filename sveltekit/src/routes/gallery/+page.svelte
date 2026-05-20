<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { GalleryItem } from '$lib/types';
	import { assetUrl, formatDate } from '$lib/utils';
	import { shareContent } from '$lib/share';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import ShareCard from '$lib/components/ShareCard.svelte';

	let { data }: { data: PageData } = $props();
	const gallery = $derived(data.gallery);
	const config  = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const galleryThumbSizes = '(max-width: 640px) calc(100vw - 32px), 640px';
	const lightboxImageSizes = 'min(92vw, 1024px)';
	type SortKey = 'latest' | 'oldest' | 'az' | 'za';
	let sortKey = $state<SortKey>('latest');
	let searchQuery = $state('');
	let tagFilter = $state('');
	let categoryFilter = $state('');
	let visiblePage = $state(1);
	const PAGE_SIZE = 12;

	// --- Lightbox state ---
	let activeItem   = $state<GalleryItem | null>(null);
	let carouselIdx  = $state(0);
	let descExpanded = $state(false);

	const images = $derived(
		activeItem
			? (activeItem.images?.length ? activeItem.images : activeItem.image ? [{ src: activeItem.image }] : [])
			: []
	);

	const currentImg = $derived(images[carouselIdx] ?? null);
	const filteredGallery = $derived.by(() => {
		let list = [...(gallery ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (tagFilter) list = list.filter((item) => item.tags?.includes(tagFilter));
		if (categoryFilter) list = list.filter((item) => item.category === categoryFilter);
		if (q) {
			list = list.filter((item) => `${item.title} ${item.caption ?? ''} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(q));
		}
		switch (sortKey) {
			case 'oldest': return list.sort((a, b) => a.date.localeCompare(b.date));
			case 'az': return list.sort((a, b) => a.title.localeCompare(b.title));
			case 'za': return list.sort((a, b) => b.title.localeCompare(a.title));
			default: return list.sort((a, b) => b.date.localeCompare(a.date));
		}
	});
	const visibleGallery = $derived(filteredGallery.slice(0, visiblePage * PAGE_SIZE));
	const hasMore = $derived(filteredGallery.length > visibleGallery.length);

	function activeSlugFromUrl(url = new URL(location.href)) {
		if (!url.pathname.startsWith('/gallery/')) return '';
		return decodeURIComponent(url.pathname.replace(/^\/gallery\/?/, '').replace(/\/$/, ''));
	}

	function openLightbox(item: GalleryItem, idx = 0, updateUrl = true) {
		activeItem   = item;
		carouselIdx  = idx;
		descExpanded = false;
		document.body.style.overflow = 'hidden';
		document.body.classList.add('gallery-lightbox-open');
		if (updateUrl && item.slug) {
			const params = location.search;
			goto(`/gallery/${encodeURIComponent(item.slug)}${params}`, {
				keepFocus: true,
				noScroll: true
			});
		}
	}

	function closeLightbox() {
		activeItem = null;
		document.body.style.overflow = '';
		document.body.classList.remove('gallery-lightbox-open');
		if (location.pathname.startsWith('/gallery/')) {
			goto(`/gallery${location.search}`, { keepFocus: true, noScroll: true });
		}
	}

	function prevImage() {
		if (!images.length) return;
		carouselIdx = (carouselIdx - 1 + images.length) % images.length;
	}

	function nextImage() {
		if (!images.length) return;
		carouselIdx = (carouselIdx + 1) % images.length;
	}

	// BL-016 — keyboard navigation
	function handleKey(e: KeyboardEvent) {
		if (!activeItem) return;
		if (e.key === 'ArrowLeft')  prevImage();
		if (e.key === 'ArrowRight') nextImage();
		if (e.key === 'Escape')     closeLightbox();
	}

	function syncFiltersFromUrl(url = new URL(location.href)) {
		tagFilter = url.searchParams.get('tag') ?? '';
		categoryFilter = url.searchParams.get('category') ?? '';
		visiblePage = 1;
	}

	onMount(() => {
		syncFiltersFromUrl();
		const slug = activeSlugFromUrl();
		if (slug) {
			const item = gallery.find((g) => g.slug === slug);
			if (item) openLightbox(item, 0, false);
		}
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	});

	afterNavigate(({ to }) => {
		if (!to?.url.pathname.startsWith('/gallery')) return;
		syncFiltersFromUrl(to.url);
		const slug = activeSlugFromUrl(to.url);
		if (!slug) {
			if (activeItem) {
				activeItem = null;
				document.body.style.overflow = '';
				document.body.classList.remove('gallery-lightbox-open');
			}
			return;
		}
		const item = gallery.find((g) => g.slug === slug);
		if (item && item.slug !== activeItem?.slug) openLightbox(item, 0, false);
	});

	onDestroy(() => {
		if (typeof document === 'undefined') return;
		document.body.style.overflow = '';
		document.body.classList.remove('gallery-lightbox-open');
	});

	function clearFilter(kind?: 'tag' | 'category') {
		const params = new URLSearchParams(location.search);
		if (!kind || kind === 'tag') params.delete('tag');
		if (!kind || kind === 'category') params.delete('category');
		goto(params.toString() ? `/gallery?${params}` : '/gallery');
	}

	// BL-019 — share item
	async function shareItem(item: GalleryItem) {
		const firstImage = item.images?.[0]?.src ?? item.image;
		const url = `${location.origin}/gallery/${encodeURIComponent(item.slug ?? item.title)}`;
		await shareContent({
			title: item.title,
			summary: item.images?.[0]?.caption ?? item.caption,
			author: config?.author,
			date: item.date,
			tags: item.tags,
			url,
			variant: 'gallery-item',
			coverUrl: firstImage,
			galleryImageUrls: firstImage ? [firstImage] : []
		});
	}

	function thumbSource(item: GalleryItem): string {
		return item.images?.[0]?.src ?? item.image ?? '';
	}
	const ogBase = $derived(String(config?.site_url ?? config?.url ?? '').replace(/\/+$/, ''));
	const galleryCoverImg = $derived(
		gallery?.find(g => g.image)?.image ??
		gallery?.find(g => g.images?.[0]?.src)?.images?.[0]?.src ??
		undefined
	);
	const galleryImgUrls = $derived(
		gallery?.slice(0, 4).map(g => g.image ?? g.images?.[0]?.src ?? '').filter(Boolean) ?? []
	);
	/** First gallery image as absolute URL for OG — falls back to generated default. */
	const ogGalleryImage = $derived((() => {
		const img = galleryCoverImg;
		if (!img) return `${ogBase}/og/defaults/gallery-landscape.jpg`;
		if (img.startsWith('http')) return img;
		return `${ogBase}${img.startsWith('/') ? img : `/${img}`}`;
	})());
</script>

<svelte:head>
	<title>Gallery · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Browse ${gallery.length} gallery photos on ${config?.hero_title ?? 'Raksara'}.`} />
	<meta property="og:title" content="Gallery · {config?.hero_title ?? 'Raksara'}" />
	<meta property="og:description" content={`Browse ${gallery.length} gallery photos on ${config?.hero_title ?? 'Raksara'}.`} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{ogBase}/gallery/" />
	<meta property="og:image" content={ogGalleryImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:image" content={ogGalleryImage} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">Gallery</h1>
		<p class="page-subtitle">{filteredGallery.length} of {gallery.length} photo{gallery.length !== 1 ? 's' : ''}</p>
	</div>
	<ShareCard
		title="Gallery"
		author={config?.author}
		variant="gallery"
		pageCount={gallery.length}
		coverUrl={galleryCoverImg}
		galleryImageUrls={galleryImgUrls}
	/>
</div>

<div class="dir-controls">
	<div class="dir-search-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
		<input
			id="dir-search"
			type="search"
			bind:value={searchQuery}
			placeholder="Search gallery…"
			class="dir-search-input"
			aria-label="Search gallery"
			oninput={() => (visiblePage = 1)}
		/>
	</div>
	<div class="dir-sort-wrap">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<select id="dir-sort" bind:value={sortKey} class="dir-sort-select" aria-label="Sort gallery" onchange={() => (visiblePage = 1)}>
			<option value="latest">Latest</option>
			<option value="oldest">Oldest</option>
			<option value="az">A → Z</option>
			<option value="za">Z → A</option>
		</select>
	</div>
</div>

{#if tagFilter || categoryFilter}
	<div class="active-filters">
		{#if tagFilter}
			<button class="tag active-filter" onclick={() => clearFilter('tag')}>#{tagFilter} ×</button>
		{/if}
		{#if categoryFilter}
			<button class="tag active-filter" onclick={() => clearFilter('category')}>{categoryFilter} ×</button>
		{/if}
		<button class="active-filter-clear" onclick={() => clearFilter()}>Clear filters</button>
	</div>
{/if}

<ul class="gallery-list">
	{#each visibleGallery as item}
		{@const count = item.images?.length ?? (item.image ? 1 : 0)}
		{@const isMulti = count > 1}
		{@const itemThumbSource = thumbSource(item)}
		{@const itemThumbLqip = buildLqipStyle(itemThumbSource, imageManifest)}
		<li class="gallery-card{isMulti ? ' multi-image' : ''}" style={itemThumbLqip}>
			<!-- Image area -->
			<div
				class="gallery-card-img is-loading"
				class:lqip-shown={!!itemThumbLqip}
				style={itemThumbLqip}
				role="button"
				tabindex="0"
				onclick={() => openLightbox(item)}
				onkeydown={(e) => e.key === 'Enter' && openLightbox(item)}
				aria-label="View {item.title}"
			>
				{#if itemThumbSource}
					<img
						{...buildResponsiveAttrs(itemThumbSource, imageManifest, { sizes: galleryThumbSizes, maxWidth: 640 })}
						alt={item.images?.[0]?.alt ?? item.images?.[0]?.caption ?? item.caption ?? item.title}
					/>
				{/if}
				{#if isMulti}
					<div class="gallery-image-count">
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="9" height="9" rx="1.5"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>{count}
					</div>
				{/if}
			</div>

			<!-- Card info -->
			<div class="gallery-card-info">
				<div class="gallery-card-header">
					<div class="gallery-card-title">{item.title}</div>
					<!-- Share button -->
					<button
						class="share-btn"
						onclick={() => shareItem(item)}
						aria-label="Share {item.title}"
					>
						<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="12" cy="3.5" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M5.8 7.1l4.4-2.5M5.8 8.9l4.4 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>

					</button>
				</div>
				<div class="gallery-card-caption" aria-hidden={!item.caption}>{item.caption || '\u00a0'}</div>
				<div class="gallery-card-footer">
					<div class="gallery-card-date">{formatDate(item.date)}</div>
				</div>
				<div class="gallery-card-tags" aria-hidden={!item.tags?.length}>
					{#if item.tags?.length}
						{#each item.tags.slice(0, 4) as tag}
							<a href="/gallery?tag={tag}" class="tag" style="padding:2px 8px;font-size:11px">{tag}</a>
						{/each}
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>

{#if !visibleGallery.length}
	<p class="italic" style="color: var(--text-tertiary);">No gallery items match your filters.</p>
{/if}

{#if hasMore}
	<div class="pagination">
		<button onclick={() => (visiblePage += 1)} style="background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 8px 20px; font-size: 13px; cursor: pointer;">
			Load more ({filteredGallery.length - visibleGallery.length} remaining)
		</button>
	</div>
{/if}

<!-- Lightbox + Carousel -->
{#if activeItem}
	<!-- backdrop -->
	<div
		class="gallery-lightbox-overlay fixed inset-0 flex items-center justify-center"
		style="background: rgba(0,0,0,0.9);"
		role="dialog"
		aria-modal="true"
		aria-label={activeItem.title}
	>
		<!-- close backdrop -->
		<button class="absolute inset-0" onclick={closeLightbox} aria-label="Close lightbox" tabindex="-1"></button>

		<figure class="relative z-10 flex max-h-screen w-full max-w-5xl flex-col items-center px-4">
			<!-- Image area -->
			<div class="relative flex w-full items-center justify-center">
				<!-- BL-016: prev arrow -->
				{#if images.length > 1}
					<button
						class="absolute left-0 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white"
						style="background: rgba(255,255,255,0.15);"
						onclick={prevImage}
						aria-label="Previous image"
					>‹</button>
				{/if}

				{#if currentImg}
					<img
						{...buildResponsiveAttrs(currentImg.src, imageManifest, { sizes: lightboxImageSizes, eager: true })}
						alt={currentImg.alt ?? currentImg.caption ?? activeItem.caption ?? activeItem.title}
						class="max-h-[72vh] rounded-xl object-contain"
					/>
				{/if}

				<!-- BL-016: next arrow -->
				{#if images.length > 1}
					<button
						class="absolute right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white"
						style="background: rgba(255,255,255,0.15);"
						onclick={nextImage}
						aria-label="Next image"
					>›</button>
				{/if}
			</div>

			<!-- Indicator dots / counter -->
			{#if images.length > 1}
				<div class="mt-3 flex items-center gap-1.5">
					{#each images as _, i}
						<button
							class="h-1.5 rounded-full transition-all"
							style={i === carouselIdx ? 'width:1.25rem;background:#fff;' : 'width:0.375rem;background:rgba(255,255,255,0.4);'}
							onclick={() => { carouselIdx = i; }}
							aria-label="Go to image {i + 1}"
						></button>
					{/each}
					<span class="ml-2 text-xs" style="color:rgba(255,255,255,0.5);">{carouselIdx + 1} / {images.length}</span>
				</div>
			{/if}

			<!-- Caption + BL-017: description expand/collapse -->
			{#if currentImg?.caption || activeItem.caption || activeItem.description}
				<figcaption class="mt-3 w-full max-w-xl text-center">
					{#if currentImg?.caption || activeItem.caption}
						<p class="text-sm" style="color:rgba(255,255,255,0.85);">{currentImg?.caption ?? activeItem.caption}</p>
					{/if}
					{#if activeItem.description}
						<button
							class="mt-1 text-xs underline"
							style="color:rgba(255,255,255,0.5);"
							onclick={() => { descExpanded = !descExpanded; }}
						>{descExpanded ? 'Hide description' : 'Show description'}</button>
						{#if descExpanded}
							<p class="mt-2 text-sm leading-relaxed" style="color:rgba(255,255,255,0.7);">{activeItem.description}</p>
						{/if}
					{/if}
				</figcaption>
			{/if}
		</figure>

		<!-- close button -->
		<button
			class="absolute right-4 top-4 z-20 text-white opacity-70 hover:opacity-100"
			onclick={closeLightbox}
			aria-label="Close"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
			</svg>
		</button>
	</div>
{/if}
