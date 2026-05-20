<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { heroTyping } from '$lib/actions/typing';
	import { assetUrl, formatDate } from '$lib/utils';
	import { buildLqipStyle, buildResponsiveAttrs } from '$lib/responsive-image';

	let { data }: { data: PageData } = $props();
	const bundle  = $derived(data.bundle);
	const config  = $derived(bundle?.config);
	const gallery = $derived(data.gallery);
	const imageManifest = $derived(data.imageManifest ?? null);

	const heroTitle = $derived(config?.hero_title ?? config?.title ?? 'Your Site Name');
	const heroSubtitle = $derived(config?.hero_subtitle ?? config?.description ?? '');
	const homeDescription = $derived(
		config?.description
			?? heroSubtitle
			?? (heroTitle ? `${heroTitle} — stories, portfolio, gallery, and thoughts.` : 'Raksara homepage')
	);
	// Use the first available gallery image as the cover (no hardcoded path that may not exist)
	const galleryCover = $derived(
		gallery?.find(g => g.image)?.image ??
		gallery?.find(g => g.images?.[0]?.src)?.images?.[0]?.src ??
		null
	);

	const postThumbSizes = '(max-width: 480px) 100px, (max-width: 640px) 120px, 180px';

	function blogPostHref(slug: string): string {
		return `/blog/post/${slug}/`;
	}

	function portfolioHref(slug: string): string {
		return `/portfolio/${slug}/`;
	}

	function shouldIgnoreCardClick(event: MouseEvent): boolean {
		return event.target instanceof Element && Boolean(event.target.closest('a, button'));
	}

	function openCard(event: MouseEvent, href: string) {
		if (shouldIgnoreCardClick(event)) return;
		goto(href);
	}

	function openCardFromKey(event: KeyboardEvent, href: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		goto(href);
	}
</script>

<svelte:head>
	<title>{config?.hero_title ?? 'Raksara'}</title>
	<meta name="description" content={homeDescription} />
</svelte:head>

<!-- Hero -->
<section class="home-hero" id="profile-hero">
	<!-- Aurora animated background -->
	<div class="home-hero-aurora" aria-hidden="true"></div>

	<!-- Hero content -->
	<div class="home-hero-content">
		<h1 class="home-hero-title" aria-label={heroTitle}>
			<span class="accent-gradient" use:heroTyping={heroTitle}></span>
		</h1>
		{#if heroSubtitle}
			<p class="home-hero-subtitle">{heroSubtitle}</p>
		{/if}
	</div>

	<!-- Wave decoration -->
	<div class="hero-waves" aria-hidden="true">
		<svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg>
		<svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg>
	</div>
</section>

<!-- Recent Posts -->
{#if bundle?.posts?.length}
	<div class="home-section">
		<div class="home-section-header">
			<h2>Recent Posts</h2>
			<a href="/blog">View all →</a>
		</div>
		<div class="post-list">
			{#each bundle.posts.slice(0, 3) as post, i}
				<div
					class="post-card{post.cover ? ' has-thumb' : ''}"
					role="link"
					tabindex="0"
					onclick={(event) => openCard(event, blogPostHref(post.slug))}
					onkeydown={(event) => openCardFromKey(event, blogPostHref(post.slug))}
				>
					{#if post.cover}
						{@const postThumbLqip = buildLqipStyle(post.cover, imageManifest)}
						<div class="post-card-thumb is-loading" class:lqip-shown={!!postThumbLqip} style={postThumbLqip}>
							<img {...buildResponsiveAttrs(post.cover, imageManifest, { sizes: postThumbSizes, eager: i === 0, maxWidth: 640 })} alt={post.title} />
						</div>
					{/if}
					<div class="post-card-body">
						<div class="post-card-title"><a href={blogPostHref(post.slug)} style="color:inherit;text-decoration:none;">{post.title}</a></div>
						{#if post.summary}
							<div class="post-card-summary">{post.summary}</div>
						{/if}
						<div class="post-card-meta">
							<span class="post-card-date">{formatDate(post.date)}</span>
							{#if post.category}
								<a href="/category/{post.category}" class="post-card-category">{post.category}</a>
							{/if}
							{#each (post.tags ?? []).slice(0, 2) as tag}
								<a href="/tag/{tag}" class="tag" style="padding:2px 8px;font-size:11px">{tag}</a>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Recent Projects -->
{#if bundle?.portfolio?.length}
	<div class="home-section">
		<div class="home-section-header">
			<h2>Projects</h2>
			<a href="/portfolio">View all →</a>
		</div>
		<div class="portfolio-grid">
			{#each bundle.portfolio.slice(0, 4) as item}
				<div
					class="portfolio-card"
					role="link"
					tabindex="0"
					onclick={(event) => openCard(event, portfolioHref(item.slug))}
					onkeydown={(event) => openCardFromKey(event, portfolioHref(item.slug))}
				>
					<div class="portfolio-card-title">
						<a href={portfolioHref(item.slug)} style="color:inherit;text-decoration:none;">{item.title}</a>
					</div>
					{#if item.summary}
						<div class="portfolio-card-summary">{item.summary}</div>
					{/if}
					{#if item.tags?.length}
						<div class="portfolio-card-tags">
							{#each item.tags.slice(0, 3) as tag}
								<span class="tag" style="padding:2px 8px;font-size:11px">{tag}</span>
							{/each}
						</div>
					{/if}
					{#if item.github || item.demo}
						<div class="portfolio-card-links">
							{#if item.github}
								<a href={item.github} target="_blank" rel="noopener" class="btn-github" onclick={(e) => e.stopPropagation()}>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
									GitHub
								</a>
							{/if}
							{#if item.demo}
								<a href={item.demo} target="_blank" rel="noopener" class="btn-demo" onclick={(e) => e.stopPropagation()}>Demo</a>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Gallery stack widget -->
{#if gallery && gallery.length > 0}
	{@const stackSources = galleryCover ? [galleryCover, galleryCover, galleryCover] : gallery.slice(0, 3).map(g => g.image ?? g.images?.[0]?.src ?? '')}
	{#if stackSources.length}
		<div class="home-section">
			<div class="gallery-window">
				<a href="/gallery" class="gallery-window-link" aria-label="View gallery">
					<div class="gallery-window-chrome">
						<div class="gallery-window-dots">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<div class="gallery-window-title">Gallery</div>
					</div>
					<div class="gallery-window-body">
						<div class="gallery-stack">
							{#each [0, 1, 2] as idx}
								{@const stackSource = stackSources[Math.min(idx, stackSources.length - 1)]}
								{@const stackLqip = buildLqipStyle(stackSource, imageManifest)}
								<div class="gallery-stack-card layer-{idx + 1} is-loading" class:lqip-shown={!!stackLqip} style={stackLqip}>
									<img
										{...buildResponsiveAttrs(stackSource, imageManifest, { sizes: '(max-width: 900px) 72vw, 560px', maxWidth: 960 })}
										alt="Gallery preview {idx + 1}"
									/>
								</div>
							{/each}
						</div>
					</div>
				</a>
			</div>
		</div>
	{/if}
{/if}

<!-- Recent Thoughts -->
{#if bundle?.thoughts?.length}
	<div class="home-section">
		<div class="home-section-header">
			<h2>Shower Thoughts</h2>
			<a href="/thoughts">View all →</a>
		</div>
		<div class="thoughts-list">
			{#each bundle.thoughts.slice(0, 2) as thought}
				<div class="thought-card">
					<p class="thought-body">{thought.body ?? thought.title}</p>
					<div class="thought-meta">
						{#if thought.title}
							<span class="thought-title">{thought.title}</span>
							<span>·</span>
						{/if}
						<span>{formatDate(thought.date)}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
