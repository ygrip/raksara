<script lang="ts">
	/**
	 * Giscus comments component.
	 * Config driven from content repo (config.json → comments or giscus block).
	 * Mirrors legacy 10-page.js initGiscus() behaviour.
	 */
	import { onMount } from 'svelte';

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

	function activeGiscusTheme() {
		return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : theme;
	}

	function syncCurrentTheme() {
		const iframe = document.querySelector<HTMLIFrameElement>('.giscus-frame');
		if (!iframe?.contentWindow) return;
		if (!iframe.src.startsWith('https://giscus.app/')) return;
		try {
			iframe.contentWindow.postMessage(
				{ giscus: { setConfig: { theme: activeGiscusTheme() } } },
				'https://giscus.app'
			);
		} catch {
			// The frame may still be about:blank/local while Giscus boots.
		}
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
		script.setAttribute('data-theme', activeGiscusTheme());
		script.setAttribute('data-lang', 'en');
		script.setAttribute('data-loading', 'lazy');
		script.crossOrigin = 'anonymous';
		script.async = true;
		script.onerror = () => script.remove();
		sentinel.appendChild(script);
		window.setTimeout(syncCurrentTheme, 700);
		window.setTimeout(syncCurrentTheme, 1500);
	}

	/** Sync dark/light theme changes to the already-loaded giscus iframe. */
	export function syncTheme(newTheme: 'light' | 'dark_dimmed') {
		const iframe = document.querySelector<HTMLIFrameElement>('.giscus-frame');
		if (!iframe?.contentWindow) return;
		if (!iframe.src.startsWith('https://giscus.app/')) return;
		try {
			iframe.contentWindow.postMessage(
				{ giscus: { setConfig: { theme: newTheme } } },
				'https://giscus.app'
			);
		} catch {
			// Ignore transient origin mismatches while Giscus is loading.
		}
	}

	onMount(() => {
		if (!sentinel) return;
		const onThemeChange = () => syncCurrentTheme();
		document.addEventListener('raksara-theme-change', onThemeChange);
		const themeObserver = new MutationObserver(syncCurrentTheme);
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
			window.clearTimeout(fallbackTimer);
			observer.disconnect();
			themeObserver.disconnect();
			document.removeEventListener('raksara-theme-change', onThemeChange);
		};
	});
</script>

<div class="giscus-container">
	<div bind:this={sentinel} class="giscus-sentinel" style="min-height:4px;"></div>
</div>
