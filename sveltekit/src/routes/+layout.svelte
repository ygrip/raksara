<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { navigating, page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import SearchOverlay from '$lib/components/SearchOverlay.svelte';
	import { getAdsenseId, getGiscusConfig } from '$lib/seo';
	import { assetUrl } from '$lib/utils';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const config = $derived(data.config);

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

	const nav = $derived(config?.nav ?? defaultNav);
	const adsenseId = $derived(config ? getAdsenseId(config) : '');
	const giscusEnabled = $derived(config ? (getGiscusConfig(config)?.enabled ?? false) : false);
	const googleVerificationTokens = $derived(config ? getGoogleVerificationTokens(config) : []);
	const currentPath = $derived($page.url.pathname);
	const canonicalHref = $derived(buildCanonicalHref(currentPath));
	const routeOwnsCanonical = $derived(currentPath.startsWith('/blog/post/'));
	const routeOwnsSocialMeta = $derived(routeHasOwnSocialMeta(currentPath));
	const robotsContent = $derived(isIndexablePath(currentPath) ? 'index, follow' : 'noindex, nofollow');
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

	function resolveDefaultOgImage(
		path: string,
		root: string,
		ogDefaults?: { site?: string; blog?: string; portfolio?: string; profile?: string }
	): string {
		if (!ogDefaults) return '';
		const resolve = (p: string) => /^https?:\/\//i.test(p) ? p : `${root}/${p.replace(/^\/+/, '')}`;
		const siteDefault = ogDefaults.site ? resolve(ogDefaults.site) : '';
		if (path.startsWith('/blog')) return ogDefaults.blog ? resolve(ogDefaults.blog) : siteDefault;
		if (path.startsWith('/portfolio')) return ogDefaults.portfolio ? resolve(ogDefaults.portfolio) : siteDefault;
		if (path === '/profile' || path.startsWith('/profile/') || path === '/about' || path.startsWith('/about/')) {
			return ogDefaults.profile ? resolve(ogDefaults.profile) : siteDefault;
		}
		return siteDefault;
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

	function isIndexablePath(pathname: string): boolean {
		const path = normalizePath(pathname);
		if (['/', '/blog', '/portfolio', '/profile', '/about', '/thoughts'].includes(path)) return true;
		if (path.startsWith('/blog/post/')) return true;
		if (path.startsWith('/portfolio/')) return true;
		if (/^\/[^/]+$/.test(path) && !['/gallery', '/tags', '/categories', '/admin'].includes(path)) return true;
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
		const giscusTheme = theme === 'light' ? 'light' : 'dark_dimmed';
		const syncGiscus = () => {
			const iframe = document.querySelector<HTMLIFrameElement>('.giscus-frame');
			if (!iframe?.contentWindow || !iframe.src.startsWith('https://giscus.app/')) return;
			try {
				iframe.contentWindow.postMessage(
					{ giscus: { setConfig: { theme: giscusTheme } } },
					'https://giscus.app'
				);
			} catch {
				// Giscus can briefly be about:blank/local before the iframe finishes loading.
			}
		};
		syncGiscus();
		window.setTimeout(syncGiscus, 400);
		document.dispatchEvent(new CustomEvent('raksara-theme-change', { detail: { theme } }));
	}

	let searchOpen = $state(false);
	let currentTheme = $state('dark');
	let sidebarOpen = $state(false);

	$effect(() => {
		if (searchOpen) sidebarOpen = false;
	});

	// BL-015: Named color palette system
	const COLOR_PALETTES: Record<string, { accent: string; hoverDark: string; hoverLight: string; g1: string; g2: string; g3: string; rgb: string }> = {
		purple: { accent: '#6366f1', hoverDark: '#818cf8', hoverLight: '#4f46e5', g1: '#6366f1', g2: '#8b5cf6', g3: '#a855f7', rgb: '99,102,241' },
		blue: { accent: '#3b82f6', hoverDark: '#60a5fa', hoverLight: '#2563eb', g1: '#3b82f6', g2: '#06b6d4', g3: '#0ea5e9', rgb: '59,130,246' },
		red: { accent: '#ef4444', hoverDark: '#f87171', hoverLight: '#dc2626', g1: '#ef4444', g2: '#f43f5e', g3: '#ec4899', rgb: '239,68,68' },
		yellow: { accent: '#eab308', hoverDark: '#facc15', hoverLight: '#ca8a04', g1: '#eab308', g2: '#f59e0b', g3: '#f97316', rgb: '234,179,8' },
		green: { accent: '#22c55e', hoverDark: '#4ade80', hoverLight: '#16a34a', g1: '#22c55e', g2: '#10b981', g3: '#14b8a6', rgb: '34,197,94' },
		orange: { accent: '#f97316', hoverDark: '#fb923c', hoverLight: '#ea580c', g1: '#f97316', g2: '#fb923c', g3: '#fbbf24', rgb: '249,115,22' },
	};

	function applyAccentColor(theme = currentTheme) {
		if (!config) return;
		const palette = COLOR_PALETTES[(config.color || '').toLowerCase()] ?? COLOR_PALETTES.purple;
		const isDark = theme !== 'light';
		const root = document.documentElement.style;
		root.setProperty('--accent', config.accent || palette.accent);
		root.setProperty('--accent-hover', isDark ? palette.hoverDark : palette.hoverLight);
		root.setProperty('--accent-subtle', `rgba(${palette.rgb},${isDark ? 0.12 : 0.08})`);
		root.setProperty('--accent-border', `rgba(${palette.rgb},${isDark ? 0.3 : 0.2})`);
		root.setProperty('--accent-glow', `rgba(${palette.rgb},${isDark ? 0.15 : 0.1})`);
		root.setProperty('--accent-rgb', palette.rgb);
		root.setProperty('--gradient-1', config.gradient_1 || palette.g1);
		root.setProperty('--gradient-2', config.gradient_2 || palette.g2);
		root.setProperty('--gradient-3', config.gradient_3 || palette.g3);
		root.setProperty('--gradient-4', config.gradient_1 || palette.g1);
		root.setProperty('--bg-hover', isDark ? 'rgba(255,255,255,0.06)' : `rgba(${palette.rgb},0.06)`);
		root.setProperty('--bg-active', isDark ? 'rgba(255,255,255,0.08)' : `rgba(${palette.rgb},0.08)`);
		root.setProperty(
			'--gradient-bg',
			`radial-gradient(ellipse 80% 60% at 20% 0%, rgba(${palette.rgb},${isDark ? 0.12 : 0.08}) 0%, transparent 50%),` +
				`radial-gradient(ellipse 60% 50% at 80% 100%, rgba(${palette.rgb},${isDark ? 0.08 : 0.06}) 0%, transparent 50%),` +
				`radial-gradient(ellipse 50% 40% at 50% 50%, rgba(${palette.rgb},${isDark ? 0.05 : 0.03}) 0%, transparent 50%)`
		);
	}

	function paletteStyle(theme = currentTheme): string {
		const palette = COLOR_PALETTES[(config?.color || '').toLowerCase()] ?? COLOR_PALETTES.purple;
		const isDark = theme !== 'light';
		const accent = config?.accent || palette.accent;
		const hover = isDark ? palette.hoverDark : palette.hoverLight;
		const subtle = `rgba(${palette.rgb},${isDark ? 0.12 : 0.08})`;
		const border = `rgba(${palette.rgb},${isDark ? 0.3 : 0.2})`;
		const glow = `rgba(${palette.rgb},${isDark ? 0.15 : 0.1})`;
		const bgHover = isDark ? 'rgba(255,255,255,0.06)' : `rgba(${palette.rgb},0.06)`;
		const bgActive = isDark ? 'rgba(255,255,255,0.08)' : `rgba(${palette.rgb},0.08)`;
		const g1 = config?.gradient_1 || palette.g1;
		const g2 = config?.gradient_2 || palette.g2;
		const g3 = config?.gradient_3 || palette.g3;
		const gradient = `radial-gradient(ellipse 80% 60% at 20% 0%, rgba(${palette.rgb},${isDark ? 0.12 : 0.08}) 0%, transparent 50%),radial-gradient(ellipse 60% 50% at 80% 100%, rgba(${palette.rgb},${isDark ? 0.08 : 0.06}) 0%, transparent 50%),radial-gradient(ellipse 50% 40% at 50% 50%, rgba(${palette.rgb},${isDark ? 0.05 : 0.03}) 0%, transparent 50%)`;
		return `:root{--accent:${accent};--accent-hover:${hover};--accent-subtle:${subtle};--accent-border:${border};--accent-glow:${glow};--accent-rgb:${palette.rgb};--gradient-1:${g1};--gradient-2:${g2};--gradient-3:${g3};--gradient-4:${g1};--bg-hover:${bgHover};--bg-active:${bgActive};--gradient-bg:${gradient};}`;
	}

	function earlyThemeScript(): string {
		const color = (config?.color || 'green').toLowerCase();
		const accent = config?.accent ?? '';
		const gradient1 = config?.gradient_1 ?? '';
		const gradient2 = config?.gradient_2 ?? '';
		const gradient3 = config?.gradient_3 ?? '';
		return `(function(){try{var palettes=${JSON.stringify(COLOR_PALETTES)};var color=${JSON.stringify(color)};var explicitAccent=${JSON.stringify(accent)};var explicitG1=${JSON.stringify(gradient1)};var explicitG2=${JSON.stringify(gradient2)};var explicitG3=${JSON.stringify(gradient3)};var theme=localStorage.getItem('raksara-theme')||'dark';var palette=palettes[color]||palettes.green||palettes.purple;var dark=theme!=='light';var root=document.documentElement;var style=root.style;root.setAttribute('data-theme',theme);root.style.colorScheme=dark?'dark':'light';style.setProperty('--accent',explicitAccent||palette.accent);style.setProperty('--accent-hover',dark?palette.hoverDark:palette.hoverLight);style.setProperty('--accent-subtle','rgba('+palette.rgb+','+(dark?0.12:0.08)+')');style.setProperty('--accent-border','rgba('+palette.rgb+','+(dark?0.3:0.2)+')');style.setProperty('--accent-glow','rgba('+palette.rgb+','+(dark?0.15:0.1)+')');style.setProperty('--accent-rgb',palette.rgb);style.setProperty('--gradient-1',explicitG1||palette.g1);style.setProperty('--gradient-2',explicitG2||palette.g2);style.setProperty('--gradient-3',explicitG3||palette.g3);style.setProperty('--gradient-4',explicitG1||palette.g1);style.setProperty('--bg-hover',dark?'rgba(255,255,255,0.06)':'rgba('+palette.rgb+',0.06)');style.setProperty('--bg-active',dark?'rgba(255,255,255,0.08)':'rgba('+palette.rgb+',0.08)');style.setProperty('--gradient-bg','radial-gradient(ellipse 80% 60% at 20% 0%, rgba('+palette.rgb+','+(dark?0.12:0.08)+') 0%, transparent 50%),radial-gradient(ellipse 60% 50% at 80% 100%, rgba('+palette.rgb+','+(dark?0.08:0.06)+') 0%, transparent 50%),radial-gradient(ellipse 50% 40% at 50% 50%, rgba('+palette.rgb+','+(dark?0.05:0.03)+') 0%, transparent 50%)');}catch(e){}})();`;
	}

	// Apply stored theme, accent colour, and optional Google Font before first paint
	onMount(() => {
		const saved = localStorage.getItem('raksara-theme') ?? 'dark';
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

		prepareImages();
		const imageObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLImageElement) {
						prepareProgressiveImage(node);
						if (node.complete) settleLoadedImage(node);
						return;
					}
					if (node instanceof HTMLElement) prepareImages(node);
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

		// AdSense: lazy-inject script only after first user interaction.
		// Skip localhost/dev so blocked ad requests do not pollute console QA.
		let injectAdsense: (() => void) | null = null;
		const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
		if (adsenseId && !isLocalHost) {
			injectAdsense = () => {
				if (document.getElementById('adsense-script')) return;
				const s = document.createElement('script');
				s.id = 'adsense-script';
				s.async = true;
				s.defer = true;
				s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`;
				s.onerror = () => s.remove();
				document.head.appendChild(s);
				['pointerdown', 'scroll', 'keydown'].forEach((ev) =>
					injectAdsense && window.removeEventListener(ev, injectAdsense, true)
				);
			};
			['pointerdown', 'scroll', 'keydown'].forEach((ev) =>
				injectAdsense && window.addEventListener(ev, injectAdsense, { once: true, passive: true, capture: true })
			);
		}

		return () => {
			document.removeEventListener('load', onImageLoad, true);
			document.removeEventListener('error', onImageLoad, true);
			imageObserver.disconnect();
			if (injectAdsense) {
				['pointerdown', 'scroll', 'keydown'].forEach((ev) =>
					window.removeEventListener(ev, injectAdsense as EventListener, true)
				);
			}
		};
	});

	function toggleTheme() {
		const next = currentTheme === 'dark' ? 'light' : 'dark';
		currentTheme = next;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('raksara-theme', next);
		applyAccentColor(next);
		syncThemeAssets(next);
	}
</script>

<svelte:head>
	{@html `<script>${earlyThemeScript()}</script>`}
	{@html `<style id="raksara-config-palette">${paletteStyle()}</style>`}
	<!-- DNS prefetch / preconnect for third-party origins -->
	{#if config?.font}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	{/if}
	{#if adsenseId}
		<link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
	{/if}
	{#if giscusEnabled}
		<link rel="dns-prefetch" href="https://giscus.app" />
	{/if}
	<title>{config?.hero_title ?? config?.title ?? ''}</title>
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
	<link id="hljs-dark" rel="stylesheet" href="/vendor/hljs/styles/github-dark.min.css" media={currentTheme === 'light' ? 'not all' : 'all'} />
	<link id="hljs-light" rel="stylesheet" href="/vendor/hljs/styles/github.min.css" media={currentTheme === 'light' ? 'all' : 'not all'} />
</svelte:head>

<!-- Fixed background gradient -->
<div class="bg-gradient" aria-hidden="true"></div>

<!-- Mobile overlay -->
{#if sidebarOpen}
	<div
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
		class="icon-btn"
		onclick={() => (sidebarOpen = !sidebarOpen)}
		aria-label="Toggle sidebar"
		aria-expanded={sidebarOpen}
	>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
		</svg>
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
	<nav id="sidebar" class:open={sidebarOpen} aria-label="Site navigation">
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
		</div>
	</main>
</div>

<SearchOverlay bind:open={searchOpen} />

{#if $navigating}
	<div class="route-loading-bar" aria-hidden="true"></div>
{/if}
