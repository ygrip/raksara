<script lang="ts">
	/**
	 * Giscus comments component.
	 * Config driven from content repo (config.json → comments or giscus block).
	 * Mirrors legacy 10-page.js initGiscus() behaviour.
	 */
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { buildVersion } from '$lib/metadata';

	interface Props {
		repo: string;
		repoId: string;
		category: string;
		categoryId: string;
		/** Page-level discussion identifier (post title or path) */
		term?: string;
		/** 'pathname' | 'title' | 'og:title' | 'specific' */
		mapping?: 'pathname' | 'title' | 'og:title' | 'specific';
		theme?: 'dark_dimmed' | 'light';
	}

	let {
		repo,
		repoId,
		category,
		categoryId,
		term,
		mapping = 'title',
		theme = 'dark_dimmed',
	}: Props = $props();

	let sentinel = $state<HTMLDivElement | null>(null);
	let injected = false;
	const previewThemes = new Map<string, string>();

	function themeUrl(name: string) {
		return new URL(`${base}/giscus-theme/${name}.css?v=${encodeURIComponent(buildVersion)}`, window.location.origin).href;
	}

	function activeGiscusTheme(initial = false) {
		const current = document.documentElement.getAttribute('data-theme') || theme;
		const name = current === 'light' ? 'light' : 'dark';
		if (window.location.protocol === 'https:') return themeUrl(name);
		// Send inline preview CSS through setConfig, not the iframe URL: embedded
		// fonts would exceed URL limits. HTTPS deployments use the public CSS URL.
		return (!initial && previewThemes.get(name)) || (name === 'light' ? 'light' : 'dark_dimmed');
	}

	async function preparePreviewThemes(signal: AbortSignal) {
		if (window.location.protocol === 'https:') return;
		try {
			const fontPath = '../fonts/plus-jakarta-sans-latin-wght-normal.woff2';
			const fontResponse = await fetch(new URL(fontPath, themeUrl('dark')), { signal });
			if (!fontResponse.ok) throw new Error(`Comments font: HTTP ${fontResponse.status}`);
			const bytes = new Uint8Array(await fontResponse.arrayBuffer());
			let binary = '';
			for (const byte of bytes) binary += String.fromCharCode(byte);
			const font = `data:font/woff2;base64,${btoa(binary)}`;
			await Promise.all(['dark', 'light'].map(async (name) => {
				const response = await fetch(themeUrl(name), { signal });
				if (!response.ok) throw new Error(`Comments theme: HTTP ${response.status}`);
				const css = (await response.text()).replace(fontPath, font);
				if (!signal.aborted) previewThemes.set(name, `data:text/css;charset=utf-8,${encodeURIComponent(css)}`);
			}));
			if (!signal.aborted) syncCurrentTheme();
		} catch (error) {
			if (!signal.aborted) console.warn('Custom comments preview theme could not load.', error);
		}
	}

	function syncCurrentTheme() {
		const iframe = sentinel?.querySelector<HTMLIFrameElement>('.giscus-frame');
		if (!iframe?.contentWindow || !iframe.src.startsWith('https://giscus.app/')) return;
		iframe.contentWindow.postMessage(
			{ giscus: { setConfig: { theme: activeGiscusTheme() } } },
			'https://giscus.app'
		);
	}

	function injectGiscus() {
		if (injected || !sentinel) return;
		if (!repo || !repoId || !category || !categoryId) return;
		injected = true;

		const script = document.createElement('script');
		script.src = 'https://giscus.app/client.js';
		script.setAttribute('data-repo', repo);
		script.setAttribute('data-repo-id', repoId);
		script.setAttribute('data-category', category);
		script.setAttribute('data-category-id', categoryId);
		script.setAttribute('data-mapping', mapping === 'og:title' ? 'og:title' : mapping);
		if (term) script.setAttribute('data-term', term);
		script.setAttribute('data-strict', '1');
		script.setAttribute('data-reactions-enabled', '1');
		script.setAttribute('data-emit-metadata', '0');
		script.setAttribute('data-input-position', 'top');
		script.setAttribute('data-theme', activeGiscusTheme(true));
		script.setAttribute('data-lang', 'en');
		script.setAttribute('data-loading', 'lazy');
		script.crossOrigin = 'anonymous';
		script.async = true;
		script.onerror = () => {
			console.warn('Giscus comments could not load.');
			script.remove();
		};
		sentinel.appendChild(script);
	}

	onMount(() => {
		if (!sentinel) return;
		const previewController = new AbortController();
		void preparePreviewThemes(previewController.signal);
		const onThemeChange = () => syncCurrentTheme();
		document.addEventListener('raksara-theme-change', onThemeChange);
		const themeObserver = new MutationObserver(syncCurrentTheme);
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		let frame: HTMLIFrameElement | null = null;
		const frameObserver = new MutationObserver(() => {
			const next = sentinel?.querySelector<HTMLIFrameElement>('.giscus-frame') || null;
			if (next === frame) return;
			frame?.removeEventListener('load', syncCurrentTheme);
			frame = next;
			frame?.addEventListener('load', syncCurrentTheme);
		});
		frameObserver.observe(sentinel, { childList: true, subtree: true });
		const fallbackTimer = window.setTimeout(injectGiscus, 1200);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					injectGiscus();
					window.clearTimeout(fallbackTimer);
					observer.disconnect();
				}
			},
			{ rootMargin: '800px' }
		);
		observer.observe(sentinel);
		return () => {
			previewController.abort();
			window.clearTimeout(fallbackTimer);
			observer.disconnect();
			themeObserver.disconnect();
			frameObserver.disconnect();
			frame?.removeEventListener('load', syncCurrentTheme);
			document.removeEventListener('raksara-theme-change', onThemeChange);
		};
	});
</script>

<div class="giscus-container">
	<div bind:this={sentinel} class="giscus-sentinel" style="min-height:4px;"></div>
</div>
