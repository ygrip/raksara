<script lang="ts">
	import type { PageData } from './$types';
	import { formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';
	import { serializeJsonLd } from '$lib/seo';

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

	const TOPIC_INTROS: Record<string, string> = {
		automation: 'Practical notes on automation testing, test architecture, tooling, and agent-assisted workflows.',
		java: 'Java engineering articles covering test automation, frameworks, tooling, and implementation patterns.',
		programming: 'Programming notes, implementation write-ups, and lessons from building software and developer tools.'
	};

	function topicName(value: string): string {
		if (value.toLowerCase() === 'java') return 'Java';
		return value
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function topicIntro(value: string): string {
		return TOPIC_INTROS[value.toLowerCase()] ?? `Articles and projects collected under the ${topicName(value)} topic.`;
	}

	function postHref(slug: string): string {
		return `/blog/post/${slug}/`;
	}

	const displayName = $derived(topicName(tag));
	const intro = $derived(topicIntro(tag));
	const siteName = $derived(config?.hero_title ?? config?.title ?? 'Raksara');
	const siteRoot = $derived(String(config?.site_url || config?.url || '').replace(/\/+$/, ''));
	const canonicalUrl = $derived(siteRoot ? `${siteRoot}/tag/${encodeURIComponent(tag)}/` : `/tag/${encodeURIComponent(tag)}/`);
	const description = $derived(`${intro} Browse ${posts?.length ?? 0} matching article${(posts?.length ?? 0) === 1 ? '' : 's'}, newest first.`);
	const collectionJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: `${displayName} | ${siteName}`,
		description,
		url: canonicalUrl,
		about: { '@type': 'Thing', name: displayName },
		mainEntity: {
			'@type': 'ItemList',
			itemListOrder: 'https://schema.org/ItemListOrderDescending',
			numberOfItems: posts?.length ?? 0,
			itemListElement: (posts ?? []).map((post, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				url: siteRoot ? `${siteRoot}${postHref(post.slug)}` : postHref(post.slug),
				name: post.title
			}))
		}
	});
</script>

<svelte:head>
	<title>{displayName} articles · {siteName}</title>
	<meta name="description" content={description} />
	{@html `<script type="application/ld+json">${serializeJsonLd(collectionJsonLd)}</script>`}
</svelte:head>

<div class="page-header">
	<div>
		<h1 class="page-title">{displayName}</h1>
		<p class="page-subtitle">{intro}</p>
	</div>
</div>

{#if posts && posts.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header">
		<h2>Articles</h2>
		<span class="page-subtitle">{posts.length} · newest first</span>
	</div>
	<div class="post-list">
		{#each posts as post}
			<a class="post-card" href={postHref(post.slug)}>
				<div class="post-card-title">{post.title}</div>
				{#if post.summary}<div class="post-card-summary">{post.summary}</div>{/if}
				<div class="post-card-meta" aria-label="Post metadata">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					{#if post.category}<span class="post-card-category">{post.category}</span>{/if}
					{#each (post.tags ?? []).slice(0, 3) as t}
						<span class="tag" style="padding:2px 8px;font-size:11px">{t}</span>
					{/each}
				</div>
			</a>
		{/each}
	</div>
</section>
{/if}

{#if portfolio && portfolio.length > 0}
<section style="margin-bottom: 32px;">
	<div class="home-section-header"><h2>Projects</h2></div>
	<div class="timeline">
		<div class="timeline-year">
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
					{#if thought.title}<span class="thought-title">{thought.title}</span>{/if}
					<span class="thought-date">{formatDate(thought.date)}</span>
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
			<li class="gallery-card" style={galleryLqip}>
				<a
					class="gallery-card-img is-loading"
					class:lqip-shown={!!galleryLqip}
					style={galleryLqip}
					href="/gallery?tag={encodeURIComponent(tag)}"
					aria-label="Filter gallery by tag {tag}"
				>
					<img {...buildResponsiveAttrs(gallerySource, imageManifest, { sizes: galleryThumbSizes, maxWidth: 640 })} alt={item.caption ?? item.title} />
				</a>
				<div class="gallery-card-info">
					<div class="gallery-card-title"><a href="/gallery?tag={tag}">{item.title}</a></div>
					{#if item.caption}<div class="gallery-card-caption">{item.caption}</div>{/if}
					<div class="gallery-card-footer"><div class="gallery-card-date">{formatDate(item.date)}</div></div>
				</div>
			</li>
		{/each}
	</ul>
</section>
{/if}

{#if total === 0}
	<p style="color: var(--text-tertiary);">No content found for <strong>{displayName}</strong>.</p>
{/if}
