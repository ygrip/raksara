<script lang="ts">
	import type { SiteConfig, TaxonomyArchivePage } from '$lib/types';
	import { formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import { taxonomyHref } from '$lib/taxonomy.js';

	let { archive, config }: { archive: TaxonomyArchivePage; config: SiteConfig } = $props();
	const galleryThumbSizes = '(max-width: 640px) calc(100vw - 32px), 640px';
	const galleryHref = $derived(`/gallery/?${new URLSearchParams({ [archive.kind]: archive.term })}`);
</script>

<div id="taxonomy-detail-results" class="taxonomy-archive">
	{#if archive.posts.length}
		<section style="margin-bottom:32px">
			<div class="home-section-header"><h2>Articles</h2></div>
			<div class="post-list">
				{#each archive.posts as post (post.slug)}
					<a class="post-card" href="/blog/post/{post.slug}/" data-taxonomy-item>
						<div class="post-card-title">{post.title}</div>
						{#if post.summary}<div class="post-card-summary">{post.summary}</div>{/if}
						<div class="post-card-meta" aria-label="Post metadata">
							<time datetime={post.date}>{formatDate(post.date)}</time>
							{#if post.status}<span class="status-chip status-{post.status}">{post.status}</span>{/if}
							{#if post.category}<span class="post-card-category">{post.category}</span>{/if}
						</div>
						<div class="post-card-tags">
							{#each (post.tags ?? []) as tag}<span class="tag">{tag}</span>{/each}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
	{#if archive.portfolio.length}
		<section style="margin-bottom:32px">
			<div class="home-section-header"><h2>Projects</h2></div>
			<div class="timeline"><div class="timeline-year">
				{#each archive.portfolio as item (item.slug)}
					<div class="timeline-item" data-taxonomy-item><div class="portfolio-card">
						<div class="portfolio-card-title"><a href="/portfolio/{item.slug}/" style="color:inherit;text-decoration:none">{item.title}</a></div>
						{#if item.summary}<div class="portfolio-card-summary">{item.summary}</div>{/if}
						{#if item.date}<time class="post-card-date" datetime={item.date}>{formatDate(item.date)}</time>{/if}
						{#if item.tags?.length}
							<div class="portfolio-card-tags">
								{#each item.tags.slice(0, 5) as tag}<a href={taxonomyHref('tag', tag, config)} class="tag">{tag}</a>{/each}
							</div>
						{/if}
					</div></div>
				{/each}
			</div></div>
		</section>
	{/if}
	{#if archive.thoughts.length}
		<section style="margin-bottom:32px">
			<div class="home-section-header"><h2>Thoughts</h2></div>
			<div class="thoughts-list">
				{#each archive.thoughts as thought (thought.slug)}
					<div class="thought-card" data-taxonomy-item>
						<p class="thought-body">{thought.body ?? thought.title}</p>
						<div class="thought-meta">
							{#if thought.title}<span class="thought-title">{thought.title}</span>{/if}
							<time class="thought-date" datetime={thought.date}>{formatDate(thought.date)}</time>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
	{#if archive.gallery.length}
		<section style="margin-bottom:32px">
			<div class="home-section-header"><h2>Gallery</h2></div>
			<ul class="gallery-list">
				{#each archive.gallery as item (item.slug)}
					{@const source = item.images?.[0]?.src ?? item.image ?? ''}
					{@const lqip = buildLqipStyle(source, archive.imageManifest)}
					<li class="gallery-card" style={lqip} data-taxonomy-item>
						<a class="gallery-card-img is-loading" class:lqip-shown={!!lqip} style={lqip} href={galleryHref} aria-label="Filter gallery by {archive.kind} {archive.term}">
							<img {...buildResponsiveAttrs(source, archive.imageManifest, { sizes: galleryThumbSizes, maxWidth: 640 })} alt={item.caption ?? item.title} />
						</a>
						<div class="gallery-card-info">
							<div class="gallery-card-title"><a href={galleryHref}>{item.title}</a></div>
							{#if item.caption}<div class="gallery-card-caption">{item.caption}</div>{/if}
							<div class="gallery-card-footer"><time class="gallery-card-date" datetime={item.date}>{formatDate(item.date)}</time></div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if archive.total === 0}<p>No content found for <strong>{archive.term}</strong>.</p>{/if}
</div>
