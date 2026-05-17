<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	let { data }: { data: PageData } = $props();
	const tag = $derived(data.tag);
	const posts = $derived(data.posts);
	const portfolio = $derived(data.portfolio);
	const thoughts = $derived(data.thoughts);
	const gallery = $derived(data.gallery);
	const config = $derived(data.config);
	const imageManifest = $derived(data.imageManifest ?? null);
	const total = $derived((posts?.length ?? 0) + (portfolio?.length ?? 0) + (thoughts?.length ?? 0) + (gallery?.length ?? 0));
	const galleryThumbSizes = '(max-width: 640px) calc(100vw - 32px), 640px';

	function postHref(slug: string): string {
		return `/blog/post/${slug}/`;
	}

	function openPostCard(event: MouseEvent, slug: string) {
		if (event.target instanceof Element && event.target.closest('a, button')) return;
		goto(postHref(slug));
	}

	function openPostCardFromKey(event: KeyboardEvent, slug: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		goto(postHref(slug));
	}
</script>

<svelte:head>
	<title>Tag: {tag} · {config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={`Items tagged ${tag} on ${config?.hero_title ?? 'Raksara'}.`} />
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">#{tag}</h1>
		<p class="page-subtitle">{total} item{total !== 1 ? 's' : ''}</p>
	</div>
</div>

{#if posts && posts.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header"><h2>Blog Posts</h2></div>
	<div class="post-list">
		{#each posts as post}
			<div
				class="post-card"
				role="link"
				tabindex="0"
				onclick={(event) => openPostCard(event, post.slug)}
				onkeydown={(event) => openPostCardFromKey(event, post.slug)}
			>
				<div class="post-card-title"><a href={postHref(post.slug)} style="color:inherit;text-decoration:none;">{post.title}</a></div>
				{#if post.summary}<div class="post-card-summary">{post.summary}</div>{/if}
				<div class="post-card-meta">
					<span class="post-card-date">{formatDate(post.date)}</span>
					{#if post.category}<a href="/category/{post.category}" class="post-card-category">{post.category}</a>{/if}
					{#each (post.tags ?? []).slice(0, 3) as t}
						<a href="/tag/{t}" class="tag" style="padding:2px 8px;font-size:11px">{t}</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</section>
{/if}

{#if gallery && gallery.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header"><h2>Gallery</h2></div>
	<ul class="gallery-list">
		{#each gallery as item}
			{@const gallerySource = item.images?.[0]?.src ?? item.image ?? ''}
			{@const galleryLqip = buildLqipStyle(gallerySource, imageManifest)}
			<li class="gallery-card">
				<div class="gallery-card-img is-loading" class:lqip-shown={!!galleryLqip} style={galleryLqip}>
					<a href="/gallery?tag={tag}" aria-label="Filter gallery by tag {tag}">
						<img {...buildResponsiveAttrs(gallerySource, imageManifest, { sizes: galleryThumbSizes, maxWidth: 640 })} alt={item.caption ?? item.title} />
					</a>
				</div>
				<div class="gallery-card-info">
					<div class="gallery-card-title"><a href="/gallery?tag={tag}" style="color:inherit;text-decoration:none;">{item.title}</a></div>
					{#if item.caption}<div class="gallery-card-caption">{item.caption}</div>{/if}
					<div class="gallery-card-footer"><div class="gallery-card-date">{formatDate(item.date)}</div></div>
				</div>
			</li>
		{/each}
	</ul>
</section>
{/if}

{#if portfolio && portfolio.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header"><h2>Portfolio</h2></div>
	<div class="timeline">
		<div class="timeline-year">
			<div class="timeline-year-label">Projects</div>
		{#each portfolio as item}
				<div class="timeline-item">
					<div class="portfolio-card">
						<div class="portfolio-card-title"><a href="/portfolio/{item.slug}/" style="color:inherit;text-decoration:none;">{item.title}</a></div>
						{#if item.summary}<div class="portfolio-card-summary">{item.summary}</div>{/if}
						{#if item.date}<div class="post-card-date">{formatDate(item.date)}</div>{/if}
					</div>
				</div>
		{/each}
		</div>
	</div>
</section>
{/if}

{#if thoughts && thoughts.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header"><h2>Thoughts</h2></div>
	<div class="thoughts-list">
		{#each thoughts as thought}
			<div class="thought-card">
				<p class="thought-body">{thought.body ?? thought.title}</p>
				<div class="thought-meta">
					{#if thought.title}<span class="thought-title">{thought.title}</span><span>·</span>{/if}
					<span>{formatDate(thought.date)}</span>
				</div>
			</div>
		{/each}
	</div>
</section>
{/if}

{#if total === 0}
	<p style="color: var(--text-tertiary);">No content found for tag <strong>#{tag}</strong>.</p>
{/if}
