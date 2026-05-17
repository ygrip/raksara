<script lang="ts">
	import type { PageData } from './$types';
	import { assetUrl, formatDate } from '$lib/utils';
	let { data }: { data: PageData } = $props();
	const cat = $derived(data.cat);
	const posts = $derived(data.posts);
	const portfolio = $derived(data.portfolio);
	const gallery = $derived(data.gallery);
	const config = $derived(data.config);
	const total = $derived(posts.length + portfolio.length + gallery.length);
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
			<div
				class="post-card"
				role="link"
				tabindex="0"
				onclick={() => (window.location.href = `/blog/post/${post.slug}`)}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (window.location.href = `/blog/post/${post.slug}`)}
			>
				<div class="post-card-title"><a href="/blog/post/{post.slug}" style="color:inherit;text-decoration:none;">{post.title}</a></div>
				{#if post.summary}<div class="post-card-summary">{post.summary}</div>{/if}
				<div class="post-card-meta">
					<span class="post-card-date">{formatDate(post.date)}</span>
					{#if post.category}<a href="/category/{post.category}" class="post-card-category">{post.category}</a>{/if}
					{#each (post.tags ?? []).slice(0, 3) as tag}
						<a href="/tag/{tag}" class="tag" style="padding:2px 8px;font-size:11px">{tag}</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
{#if gallery.length}
	<div class="home-section-header"><h2>Gallery</h2></div>
	<ul class="gallery-list" style="margin-bottom: 24px;">
		{#each gallery as item}
			<li class="gallery-card">
				<div class="gallery-card-img is-loading">
					<a href="/gallery?category={cat}" aria-label="Filter gallery by category {cat}">
						<img src={assetUrl(item.images?.[0]?.src ?? item.image)} alt={item.caption ?? item.title} loading="lazy" />
					</a>
				</div>
				<div class="gallery-card-info">
					<div class="gallery-card-title"><a href="/gallery?category={cat}" style="color:inherit;text-decoration:none;">{item.title}</a></div>
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
						<div class="portfolio-card-title"><a href="/portfolio/{item.slug}" style="color:inherit;text-decoration:none;">{item.title}</a></div>
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
