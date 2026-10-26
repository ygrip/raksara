<script lang="ts">
	import './layout.css';
	import './visual-polish.css';
	import './heritage-glass.css';
	import './motion.css';
	import './popup-motion.css';
	import './tab-container.css';
	import { popupMotion, sidebarDialog } from '$lib/popup-motion';
	import { onMount } from 'svelte';
	import { navigating, page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import ContentFooter from '$lib/components/ContentFooter.svelte';
	import AdcashAutoTag from '$lib/components/AdcashAutoTag.svelte';
	import { getGiscusConfig, resolveDefaultOgImage } from '$lib/seo';
	import { resolveAdsenseConfig, isAdsensePathEligible } from '$lib/advertising.js';
	import { assetUrl } from '$lib/utils';
	import { themeTokens, earlyThemeScript } from '$lib/theme';
	import { isTaxonomyPath, isIndexableTaxonomyPath } from '$lib/taxonomy.js';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const config = $derived(data.config);
	let AgenticTools: typeof import('$lib/components/AgenticTools.svelte').default | null = $state(null);
	let Fireflies: typeof import('$lib/components/Fireflies.svelte').default | null = $state(null);

	// Enhancements load after the page; none is required for first paint.
	onMount(() => {
		let disposed = false;
		let cancelIdle = () => {};
		const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
		const ambient = !connection?.saveData
			&& !matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)').matches;
		const load = async () => {
			// Carved ukiran dividers swap in for the 1px fallback line only once the
			// (compressed) mask is decoded, so it never competes with first paint.
			if (!connection?.saveData) {
				const divider = new Image();
				divider.src = '/heritage/ukiran-divider.webp';
				divider.decode()
					.then(() => { if (!disposed) document.documentElement.classList.add('hg-divider-ready'); })
					.catch((error) => console.warn('[ukiran] Divider unavailable; keeping the hairline.', error));
			}
			if (ambient) {
				import('$lib/components/Fireflies.svelte')
					.then((module) => { if (!disposed) Fireflies = module.default; })
					.catch((error) => console.warn('[fireflies] Enhancement unavailable; keeping the static background.', error));
			}
			try {
				const module = await import('$lib/components/AgenticTools.svelte');
				if (!disposed) AgenticTools = module.default;
			} catch (error) {
				console.warn('[agentic] Enhancement unavailable.', error);
			}
		};
		const defer = () => {
			if ('requestIdleCallback' in window) {
				const id = window.requestIdleCallback(() => void load(), { timeout: 2500 });
				cancelIdle = () => window.cancelIdleCallback(id);
			} else {
				const id = setTimeout(() => void load(), 1000);
				cancelIdle = () => clearTimeout(id);
			}
		};
		if (document.readyState === 'complete') defer();
		else window.addEventListener('load', defer, { once: true });
		return () => {
			disposed = true;
			window.removeEventListener('load', defer);
			cancelIdle();
		};
	});

	const defaultNav = [
		{ label: 'Home', href: '/' },
		{ label: 'Profile', href: '/profile' },
		{ label: 'Blog', href: '/blog' },
		{ label: 'Portfolio', href: '/portfolio' },
		{ label: 'Gallery', href: '/gallery' },
		{ label: 'Thoughts', href: '/thoughts' },
		{ label: 'Tags', href: '/tags' },
		{ label: 'Categories', href: '/categories' },
		{ label: 'About', href: '/about' },
	];

	const LOCAL_FOOTER_ROUTES = new Set([
		'/[page]',
		'/doc/[slug]',
		'/doc/[...path]',
		'/portfolio/[slug]',
		'/blog/post/[...slug]',
	]);

	// Documentation is reachable from the About page only; keep it out of site navigation.
	const isDocsHref = (href: string) => /^\/(documentation|doc)(\/|$)/.test(href);
	const nav = $derived((config?.nav ?? defaultNav).filter((link) => !isDocsHref(link.href)));
	const adsenseSettings = $derived(resolveAdsenseConfig(config));
	const giscusEnabled = $derived(config ? (getGiscusConfig(config)?.enabled ?? false) : false);
	const googleVerificationTokens = $derived(config ? getGoogleVerificationTokens(config) : []);
	const currentPath = $derived($page.url.pathname);
	const routeUsesLocalFooter = $derived(LOCAL_FOOTER_ROUTES.has($page.route.id ?? ''));
	const canonicalHref = $derived(buildCanonicalHref(currentPath));
	const routeOwnsCanonical = $derived(currentPath.startsWith('/blog/post/') || (isTaxonomyPath(currentPath) && !isIndexableTaxonomyPath(currentPath, config)));
	const routeOwnsSocialMeta = $derived(routeHasOwnSocialMeta(currentPath));
	const robotsContent = $derived(isIndexablePath(currentPath) ? 'index, follow' : shouldFollowPath(currentPath) ? 'noindex, follow' : 'noindex, nofollow');
	// Used for absolute OG image URLs (WhatsApp / social platforms require https://)
	const siteRoot = $derived(
		String(config?.site_url || config?.url || $page.url.origin).replace(/\/+$/, '')
	);
	const defaultOgImage = $derived(resolveDefaultOgImage(currentPath, siteRoot, config?.og_defaults));
	function isActiveLink(href: string): boolean {
		const normalizedHref = href === '/' ? '/' : href.replace(/\/$/, '');
		const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
		if (normalizedHref === '/') return normalizedPath === '/';
		return normalizedPath === normalizedHref || normalizedPath.startsWith(normalizedHref + '/');
	}

	function buildCanonicalHref(pathname: string): string {
		const siteUrl = String(config?.site_url || config?.url || $page.url.origin).replace(/\/+$/, '');
		if (!pathname || pathname === '/') return `${siteUrl}/`;
		const cleanPath = `/${pathname.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
		return `${siteUrl}${cleanPath}`;
	}

	function normalizePath(pathname: string): string {
		if (!pathname || pathname === '/') return '/';
		return `/${pathname.replace(/^\/+/, '').replace(/\/+$/, '')}`;
	}

	/** Single-segment routes that must stay out of the index (galleries, indexes, admin, demo pages). */
	const NOINDEX_SINGLE_SEGMENT_PATHS = ['/gallery', '/tags', '/categories', '/admin', '/chapters-demo', '/google-sitelinks'];

	function shouldFollowPath(pathname: string): boolean {
		const path = normalizePath(pathname);
		if (isTaxonomyPath(path)) return true;
		if (path.startsWith('/blog/dir/')) return true;
		if (['/', '/blog', '/portfolio', '/profile', '/about', '/thoughts', '/tags', '/categories', '/gallery'].includes(path)) return true;
		return false;
	}

	function isIndexablePath(pathname: string): boolean {
		const path = normalizePath(pathname);
		if (isTaxonomyPath(path)) return isIndexableTaxonomyPath(path, config);
		if (['/', '/blog', '/portfolio', '/profile', '/about', '/thoughts'].includes(path)) return true;
		if (path.startsWith('/blog/post/')) return true;
		if (path.startsWith('/portfolio/')) return true;
		if (/^\/[^/]+$/.test(path) && !NOINDEX_SINGLE_SEGMENT_PATHS.includes(path)) return true;
		return false;
	}

	function routeHasOwnSocialMeta(pathname: string): boolean {
		const path = normalizePath(pathname);
		return (
			path === '/' ||
			path === '/blog' ||
			path.startsWith('/blog/post/') ||
			path === '/portfolio' ||
			path.startsWith('/portfolio/') ||
			path === '/profile' ||
			path === '/thoughts' ||
			path === '/gallery' ||
			path.startsWith('/gallery/')
		);
	}

	function getGoogleVerificationTokens(siteConfig: LayoutData['config']): string[] {
		if (!siteConfig) return [];
		const rawConfig = siteConfig as typeof siteConfig & {
			google_search_console?: string | string[];
			googleSearchConsole?: string | string[];
		};
		const raw =
			siteConfig.google_site_verification
			?? siteConfig.googleSiteVerification
			?? rawConfig.google_search_console
			?? rawConfig.googleSearchConsole;
		const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
		return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
	}

	function navigateSidebar(event: MouseEvent, href: string) {
		event.preventDefault();
		sidebarOpen = false;
		goto(href);
	}

	const progressiveImageShellSelector = '.is-loading, .post-card-thumb, .gallery-card-img, .gallery-stack-card, .article-cover, .poem-cover, .img-skeleton';

	function progressiveImageShell(img: HTMLImageElement) {
		return img.closest<HTMLElement>(progressiveImageShellSelector);
	}

	function prepareProgressiveImage(img: HTMLImageElement) {
		const shell = progressiveImageShell(img);
		if (!shell || shell.classList.contains('is-loaded')) return;
		const lqip = img.dataset['lqip'];
		if (lqip && !shell.classList.contains('lqip-shown')) {
			shell.style.setProperty('--lqip-url', `url("${lqip}")`);
			shell.classList.add('lqip-shown');
		}
	}

	function settleLoadedImage(img: HTMLImageElement) {
		const shell = progressiveImageShell(img);
		prepareProgressiveImage(img);
		if (!img.complete || (img.naturalWidth === 0 && !img.currentSrc && !img.src)) return;
		if (shell && !img.dataset['lqip'] && (img.currentSrc || img.src)) {
			shell.style.setProperty('--lqip-url', `url("${img.currentSrc || img.src}")`);
			shell.classList.add('lqip-shown');
		}
		img.classList.add('loaded');
		shell?.classList.remove('is-loading');
		shell?.classList.add('is-loaded');
	}

	function syncThemeAssets(theme: string) {
		document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
		const hljsDark = document.getElementById('hljs-dark') as HTMLLinkElement | null;
		const hljsLight = document.getElementById('hljs-light') as HTMLLinkElement | null;
		if (hljsDark) {
			hljsDark.disabled = theme === 'light';
			hljsDark.media = theme === 'light' ? 'not all' : 'all';
		}
		if (hljsLight) {
			hljsLight.disabled = theme !== 'light';
			hljsLight.media = theme === 'light' ? 'all' : 'not all';
		}
		document.dispatchEvent(new CustomEvent('raksara-theme-change', { detail: { theme } }));
	}

	let searchOpen = $state(false);
	let SearchOverlay: any = $state(null);
	let searchOverlayPromise: Promise<void> | null = null;
	let currentTheme = $state('dark');
	let sidebarOpen = $state(false);

	$effect(() => {
		if (!searchOpen) return;
		sidebarOpen = false;
		if (!SearchOverlay && !searchOverlayPromise) {
			searchOverlayPromise = import('$lib/components/SearchOverlay.svelte')
				.then((module) => {
					SearchOverlay = module.default;
				})
				.finally(() => {
					searchOverlayPromise = null;
				});
		}
	});

	function getPwaAssetVersion(siteConfig: LayoutData['config']): string {
		if (!siteConfig) return 'default';
		const extended = siteConfig as typeof siteConfig & { pwa_asset_version?: string };
		if (extended.pwa_asset_version) return String(extended.pwa_asset_version);
		return [siteConfig.color ?? 'purple', siteConfig.accent ?? '', siteConfig.logo ?? '']
			.join('-')
			.replace(/[^a-zA-Z0-9_-]+/g, '-');
	}

	const selectedAccent = $derived(themeTokens(config ?? {}, currentTheme)['--accent']);
	const pwaAssetVersion = $derived(getPwaAssetVersion(config));
	const pwaAssetQuery = $derived(`?v=${encodeURIComponent(pwaAssetVersion)}`);

	function applyAccentColor(theme = currentTheme) {
		for (const [key, value] of Object.entries(themeTokens(config ?? {}, theme))) {
			document.documentElement.style.setProperty(key, value);
		}
	}

	function paletteStyle(): string {
		return ['dark', 'light'].map(theme => {
			const tokens = Object.entries(themeTokens(config ?? {}, theme)).map(([key, value]) => `${key}:${value};`).join('');
			return `${theme === 'dark' ? ':root' : '[data-theme="light"]'}{${tokens}}`;
		}).join('');
	}

	// Apply stored theme, accent colour, and optional Google Font before first paint
	onMount(() => {
		const saved = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
		currentTheme = saved;
		document.documentElement.setAttribute('data-theme', saved);
		syncThemeAssets(saved);
		document.body.classList.add('sidebar-ready');

		if (config) {
			applyAccentColor(saved);

			// Google Font injection (lazy — only if font specified)
			if (config.font) {
				const fontName = config.font.trim();
				const linkId = 'raksara-font';
				if (!document.getElementById(linkId)) {
					// Inject preconnect hints only when font is actually used
					const pre1 = document.createElement('link');
					pre1.rel = 'preconnect';
					pre1.href = 'https://fonts.googleapis.com';
					document.head.appendChild(pre1);
					const pre2 = document.createElement('link');
					pre2.rel = 'preconnect';
					pre2.href = 'https://fonts.gstatic.com';
					pre2.crossOrigin = 'anonymous';
					document.head.appendChild(pre2);

					const link = document.createElement('link');
					link.id = linkId;
					link.rel = 'stylesheet';
					link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
					document.head.appendChild(link);
					document.documentElement.style.setProperty('--font-sans', `"${fontName}", system-ui, sans-serif`);
				}
			}

			// BL-014: SVG logo injection
			if (config.logo) {
				// Fetch and inject inline SVG to allow CSS colour overrides
				fetch(assetUrl(config.logo))
					.then((r) => (r.ok ? r.text() : Promise.reject()))
					.then((svg) => {
						const logoEl = document.getElementById('site-logo-img');
						if (logoEl) logoEl.innerHTML = svg;
						const logoMobile = document.getElementById('site-logo-img-mobile');
						if (logoMobile) logoMobile.innerHTML = svg;
					})
					.catch(() => {/* leave text title as fallback */});
			}
		}

		const prepareImages = (root: ParentNode = document) => {
			root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
				prepareProgressiveImage(img);
				if (img.complete) settleLoadedImage(img);
			});
		};

		// Cap visual post tags at two rows; the gradient appears only if chips
		// actually overflow. One observer tracks viewport/layout changes for all
		// cards, including prerendered home content and client-side navigation.
		const trackedTagRows = new Set<HTMLElement>();
		const syncTagOverflow = (tags: HTMLElement) => {
			tags.classList.toggle('is-overflowing', tags.scrollHeight > tags.clientHeight + 1);
		};
		const tagResizeObserver = new ResizeObserver((entries) => {
			for (const { target } of entries) if (target instanceof HTMLElement) syncTagOverflow(target);
		});
		const observeTagRows = (root: ParentNode) => {
			const track = (tags: HTMLElement) => {
				if (trackedTagRows.has(tags)) return;
				trackedTagRows.add(tags);
				tagResizeObserver.observe(tags);
				syncTagOverflow(tags);
			};
			if (root instanceof HTMLElement && root.matches('.post-card-tags')) track(root);
			root.querySelectorAll<HTMLElement>('.post-card-tags').forEach(track);
		};
		const forgetTagRows = (root: HTMLElement) => {
			const forget = (tags: HTMLElement) => {
				tagResizeObserver.unobserve(tags);
				trackedTagRows.delete(tags);
			};
			if (root.matches('.post-card-tags')) forget(root);
			root.querySelectorAll<HTMLElement>('.post-card-tags').forEach(forget);
		};

		prepareImages();
		observeTagRows(document);
		const imageObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				// Chips may change without the card changing size; check the new rows.
				if (mutation.target instanceof HTMLElement) {
					const tags = mutation.target.closest<HTMLElement>('.post-card-tags');
					if (tags) syncTagOverflow(tags);
				}
				mutation.removedNodes.forEach((node) => {
					if (node instanceof HTMLElement) forgetTagRows(node);
				});
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLImageElement) {
						prepareProgressiveImage(node);
						if (node.complete) settleLoadedImage(node);
						return;
					}
					if (node instanceof HTMLElement) {
						prepareImages(node);
						observeTagRows(node);
					}
				});
			}
		});
		imageObserver.observe(document.body, { childList: true, subtree: true });

		const onImageLoad = (event: Event) => {
			const target = event.target;
			if (target instanceof HTMLImageElement) settleLoadedImage(target);
		};
		document.addEventListener('load', onImageLoad, true);
		document.addEventListener('error', onImageLoad, true);

		const onDiagramThemeChange = () => {
			const app = document.getElementById('app');
			if (!app?.querySelector('.rk-mermaid')) return;
			document.querySelector<HTMLButtonElement>('.mermaid-viewer-close')?.click();
			void import('$lib/markdown').then(({ initMermaid }) => initMermaid(app));
		};
		document.addEventListener('raksara-theme-change', onDiagramThemeChange);

		const onGlobalSearchKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') sidebarOpen = false;
			if (event.key !== '/' || ['INPUT', 'TEXTAREA'].includes((event.target as Element)?.tagName ?? '')) return;
			event.preventDefault();
			searchOpen = true;
		};
		window.addEventListener('keydown', onGlobalSearchKey);

		// Verification is prerendered; script loading is an explicit site choice.
		// Keep listeners until visiting an eligible route, including client-side
		// navigation from a directory to an article.
		let interacted = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive === true;
		const settings = adsenseSettings;
		const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
		const canLoad = settings.enabled && settings.allowedPaths.length > 0
			&& (!isLocalHost || settings.allowLocalhost);
		const injectAdsense = () => {
			if (!canLoad || (settings.loadStrategy === 'interaction' && !interacted)) return;
			if (!isAdsensePathEligible($page.url.pathname, settings)) return;
			if (document.getElementById('adsense-script')) return;
			const script = document.createElement('script');
			script.id = 'adsense-script';
			script.async = true;
			script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.clientId}`;
			script.onerror = () => script.remove();
			document.head.appendChild(script);
		};
		const onAdInteraction = () => {
			interacted = true;
			injectAdsense();
		};
		if (canLoad && settings.loadStrategy === 'interaction') {
			for (const name of ['pointerdown', 'scroll', 'keydown']) {
				window.addEventListener(name, onAdInteraction, { passive: true, capture: true });
			}
		}
		// Subscribe to route changes so interacting on an excluded page does not
		// permanently prevent ad initialization on subsequent allowed pages.
		const unsubscribeAdRoute = canLoad ? page.subscribe(() => injectAdsense()) : () => {};
		if (settings.loadStrategy === 'immediate') injectAdsense();

		return () => {
			document.removeEventListener('load', onImageLoad, true);
			document.removeEventListener('error', onImageLoad, true);
			window.removeEventListener('keydown', onGlobalSearchKey);
			document.removeEventListener('raksara-theme-change', onDiagramThemeChange);
			imageObserver.disconnect();
			tagResizeObserver.disconnect();
			trackedTagRows.clear();
			unsubscribeAdRoute();
			for (const name of ['pointerdown', 'scroll', 'keydown']) {
				window.removeEventListener(name, onAdInteraction, true);
			}
		};
	});

	function toggleTheme() {
		const next = currentTheme === 'dark' ? 'light' : 'dark';
		currentTheme = next;
		document.documentElement.setAttribute('data-theme', next);
		try { localStorage.setItem('raksara-theme', next); }
		catch { /* Private/storage-disabled browsing still switches this session. */ }
		applyAccentColor(next);
		syncThemeAssets(next);
	}
</script>

<svelte:head>
	{@html `<script>${earlyThemeScript(config ?? {})}</script>`}
	{@html `<style id="raksara-config-palette">${paletteStyle()}</style>`}
	<meta name="theme-color" content={selectedAccent} />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<link rel="icon" type="image/svg+xml" href={`/favicon.svg${pwaAssetQuery}`} />
	<link rel="icon" type="image/x-icon" href={`/favicon.ico${pwaAssetQuery}`} />
	<link rel="apple-touch-icon" href={`/apple-touch-icon.png${pwaAssetQuery}`} />
	<link rel="manifest" href={`/site.webmanifest${pwaAssetQuery}`} />
	<!-- DNS prefetch / preconnect for third-party origins -->
	{#if config?.font}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	{/if}
	{#if adsenseSettings.enabled}
		<meta name="google-adsense-account" content={adsenseSettings.clientId} />
		<link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
	{/if}
	{#if giscusEnabled}
		<link rel="dns-prefetch" href="https://giscus.app" />
	{/if}
	<link rel="alternate" type="application/rss+xml" title={`${config?.hero_title ?? config?.title ?? 'Raksara'} RSS feed`} href={`${siteRoot}/feed.xml`} />
	<link rel="alternate" type="application/atom+xml" title={`${config?.hero_title ?? config?.title ?? 'Raksara'} Atom feed`} href={`${siteRoot}/atom.xml`} />
	{#each googleVerificationTokens as token}
		<meta name="google-site-verification" content={token} />
	{/each}
	<meta name="robots" content={robotsContent} />
	{#if !routeOwnsCanonical}
		<link rel="canonical" href={canonicalHref} />
	{/if}
	<meta property="og:site_name" content={config?.hero_title ?? config?.title ?? ''} />
	{#if !routeOwnsSocialMeta}
		<meta property="og:type" content="website" />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
	{#if defaultOgImage && !routeOwnsSocialMeta}
		<meta property="og:image" content={defaultOgImage} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
{#if routeUsesLocalFooter}
		<link id="hljs-dark" rel="stylesheet" href="/vendor/hljs/styles/github-dark.min.css" media={currentTheme === 'light' ? 'not all' : 'all'} />
		<link id="hljs-light" rel="stylesheet" href="/vendor/hljs/styles/github.min.css" media={currentTheme === 'light' ? 'all' : 'not all'} />
	{/if}
</svelte:head>

<!-- Static dot grid and accent lighting; fireflies are deferred, compositor-only CSS animation. -->
<div class="bg-gradient" aria-hidden="true">
	{#if Fireflies && currentPath.replace(/\/+$/, '') !== '/profile'}<Fireflies />{/if}
</div>

<!-- Mobile overlay -->
{#if sidebarOpen}
	<div
		in:popupMotion|global={{ scrim: true }} out:popupMotion|global={{ scrim: true, closing: true }}
		class="sidebar-overlay fixed inset-0 z-30 lg:hidden"
		role="button"
		tabindex="-1"
		onclick={() => (sidebarOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
		style="background: rgba(0,0,0,0.5);"
	></div>
{/if}

<!-- Mobile header -->
<header class="mobile-header">
	<button
		class="icon-btn sidebar-toggle"
		class:is-open={sidebarOpen}
		onclick={() => (sidebarOpen = !sidebarOpen)}
		aria-controls="sidebar"
		aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
		aria-expanded={sidebarOpen}
	>
		<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
	</button>
	<a href="/" class="logo" onclick={(event) => navigateSidebar(event, '/')}>
		<span class="logo-icon" aria-hidden={!!config?.logo}><span id="site-logo-img-mobile"></span></span>
		<span class="logo-text">{config?.hero_title ?? config?.title ?? ''}</span>
	</a>
	<button class="icon-btn mobile-theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
		<svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
		<svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
	</button>
</header>

<div id="app">
	<!-- Sidebar Nav -->
	<nav id="sidebar" use:sidebarDialog={sidebarOpen} class:open={sidebarOpen} aria-label="Site navigation">
		<div class="sidebar-header">
			<a href="/" class="logo" onclick={(event) => navigateSidebar(event, '/')}>
				<!-- BL-014: SVG logo placeholder; JS fills it if config.logo is set -->
				<span class="logo-icon"><span id="site-logo-img"></span></span>
					<span class="logo-text">{config?.hero_title ?? config?.title ?? ''}</span>
			</a>
			<div class="sidebar-header-actions">
				<button id="theme-toggle" class="icon-btn" onclick={toggleTheme} aria-label="Toggle theme">
					<svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
					<svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</button>
			</div>
		</div>

		<button class="search-trigger glass" onclick={() => (searchOpen = true)} aria-label="Open search (press /)">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
			<span>Search...</span>
			<kbd>/</kbd>
		</button>

		<nav class="sidebar-nav">
			{#each nav as link}
				{@const route = link.href.replace(/^\/|\/$/g, '') || 'home'}
				<a href={link.href} class="nav-link" class:active={isActiveLink(link.href)} data-route={route} onclick={(event) => navigateSidebar(event, link.href)}>
					{#if route === 'home' || link.href === '/'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8.5l6-6 6 6M3.5 7.5V13a1 1 0 001 1h2.5V11h2v3h2.5a1 1 0 001-1V7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else if route === 'profile'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
					{:else if route === 'blog'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
					{:else if route === 'portfolio'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="3" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="9.5" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9.5" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
					{:else if route === 'gallery'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1"/><path d="M2 12l3.5-4 2.5 3 2-2.5L14 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else if route === 'thoughts'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C4.7 2 2 4.2 2 7c0 1.6.9 3 2.3 3.9L3.5 14l3-1.5c.5.1 1 .2 1.5.2 3.3 0 6-2.2 6-5s-2.7-5-6-5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else if route === 'tags'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8.586V3a1 1 0 011-1h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L2.293 9.293A1 1 0 012 8.586z" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>
					{:else if route === 'categories'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L8.854 4.145A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>
					{:else if route === 'documentation' || route.startsWith('doc')}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 4.2C6.7 3.1 4.8 2.6 2.5 2.7v9.6c2.3-.1 4.2.4 5.5 1.5 1.3-1.1 3.2-1.6 5.5-1.5V2.7c-2.3-.1-4.2.4-5.5 1.5zM8 4.2v9.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else if route === 'contact'}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 4.5L8 8.75l5.5-4.25" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v4M8 5.5v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
					{/if}
					{link.label}
				</a>
			{/each}
		</nav>
	</nav>

	<main id="content">
		<div class="page-content">
			{@render children()}
			{#if !routeUsesLocalFooter}
				<ContentFooter author={config?.author} logo={config?.logo} />
			{/if}
		</div>
	</main>
</div>

{#if AgenticTools}<AgenticTools />{/if}
<AdcashAutoTag />

{#if SearchOverlay}
	<SearchOverlay bind:open={searchOpen} />
{/if}

{#if $navigating}
	<div class="route-loading-bar" aria-hidden="true"></div>
{/if}

<style>
	#content {
		display: flex;
		flex-direction: column;
	}

	/* Column flex so ContentFooter's spacer can push the footer to the bottom
	   on short pages. */
	.page-content {
		width: 100%;
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
	}
</style>
