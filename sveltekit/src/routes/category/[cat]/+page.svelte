<script lang="ts">
	import type { PageData } from './$types';
	import { formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	let { data }: { data: PageData } = $props();
	const cat = $derived(data.cat);
	const posts = $derived(data.posts);
	const portfolio = $derived(data.portfolio);
	const gallery = $derived(data.gallery);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const total = $derived(posts.length + portfolio.length + gallery.length);
	const galleryThumbSizes = '(max-width: 640px) calc(100vw - 32px), 640px';

	function postHref(slug: string): string {
		return `/blog/post/${slug}/`;
	}
</script>

<svelte:head>
	<title>Category: {cat} · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Items in category ${cat} on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">{cat}</h1>
		<p class="page-subtitle">{total} item{total !== 1 ? 's' : ''}</p>
	</div>
</div>

{#if posts.length}
	<div class="home-section-header"><h2>Posts</h2></div>
	<div class="post-list" style="margin-bottom: 24px;">
		{#each posts as post}
			<a
				class="post-card"
				href={postHref(post.slug)}
			>
				<div class="post-card-title">{post.title}</div>
				{#if post.summary}<div class="post-card-summary">{post.summary}</div>{/if}
				<div class="post-card-meta" aria-label="Post metadata">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					{#if post.category}<span class="post-card-category">{post.category}</span>{/if}
					{#each (post.tags ?? []).slice(0, 3) as tag}
						<span class="tag" style="padding:2px 8px;font-size:11px">{tag}</span>
					{/each}
				</div>
			</a>
		{/each}
	</div>
{/if}
{#if gallery.length}
	<div class="home-section-header"><h2>Gallery</h2></div>
	<ul class="gallery-list" style="margin-bottom: 24px;">
		{#each gallery as item}
			{@const gallerySource = item.images?.[0]?.src ?? item.image ?? ''}
			{@const galleryLqip = buildLqipStyle(gallerySource, imageManifest)}
			<li class="gallery-card" style={galleryLqip}>
				<a
					class="gallery-card-img is-loading"
					class:lqip-shown={!!galleryLqip}
					style={galleryLqip}
					href="/gallery?category={encodeURIComponent(cat)}"
					aria-label="Filter gallery by category {cat}"
				>
					<img {...buildResponsiveAttrs(gallerySource, imageManifest, { sizes: galleryThumbSizes, maxWidth: 640 })} alt={item.caption ?? item.title} />
				</a>
				<div class="gallery-card-info">
					<div class="gallery-card-title"><a href="/gallery?category={cat}">{item.title}</a></div>
					{#if item.caption}<div class="gallery-card-caption">{item.caption}</div>{/if}
					<div class="gallery-card-footer"><div class="gallery-card-date">{formatDate(item.date)}</div></div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
{#if portfolio.length}
	<div class="home-section-header"><h2>Projects</h2></div>
	<div class="timeline">
		<div class="timeline-year">
			<div class="timeline-year-label">Projects</div>
		{#each portfolio as item}
				<div class="timeline-item">
					<div class="portfolio-card">
						<div class="portfolio-card-title"><a href="/portfolio/{item.slug}/" style="color:inherit;text-decoration:none;">{item.title}</a></div>
						{#if item.summary}<div class="portfolio-card-summary">{item.summary}</div>{/if}
						{#if item.tags?.length}
							<div class="portfolio-card-tags">
								{#each item.tags.slice(0, 5) as tag}
									<a href="/tag/{tag}" class="tag" style="padding:3px 10px;font-size:11px">{tag}</a>
								{/each}
							</div>
						{/if}
					</div>
				</div>
		{/each}
		</div>
	</div>
{/if}
