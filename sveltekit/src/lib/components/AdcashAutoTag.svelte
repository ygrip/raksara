<script lang="ts">
	import { onMount } from 'svelte';
	import { loadConfig } from '$lib/metadata';
	import type { SiteConfig } from '$lib/types';

	type LoadStrategy = 'immediate' | 'interaction';

	interface AdcashAutoTagConfig {
		enabled?: boolean;
		zone_id?: string;
	}

	interface AdcashConfig {
		enabled?: boolean;
		library_url?: string;
		load_strategy?: LoadStrategy;
		allow_localhost?: boolean;
		excluded_paths?: string[];
		auto_tag?: AdcashAutoTagConfig;
	}

	interface AdvertisingSiteConfig extends SiteConfig {
		advertising?: {
			adcash?: AdcashConfig;
		};
	}

	interface AdcashLibrary {
		runAutoTag: (options: { zoneId: string }) => void;
	}

	type AdcashWindow = Window & {
		aclib?: AdcashLibrary;
		__raksaraAdcashZones?: Set<string>;
	};

	type NavigatorWithActivation = Navigator & {
		userActivation?: { hasBeenActive?: boolean };
	};

	const DEFAULT_LIBRARY_URL = 'https://acscdn.com/script/aclib.js';
	const DEFAULT_EXCLUDED_PATHS = ['/admin'];
	const INTERACTION_EVENTS = ['pointerdown', 'scroll', 'keydown'] as const;

	function clean(value: unknown): string {
		return String(value ?? '').trim();
	}

	function normalizePath(value: unknown): string {
		const path = clean(value);
		if (!path || path === '/') return '/';
		return `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
	}

	function isLocalHost(hostname: string): boolean {
		return ['localhost', '127.0.0.1', '::1'].includes(hostname);
	}

	function isExcludedPath(pathname: string, configuredPaths?: string[]): boolean {
		const current = normalizePath(pathname);
		const excluded = configuredPaths?.length ? configuredPaths : DEFAULT_EXCLUDED_PATHS;
		return excluded.some((value) => {
			const path = normalizePath(value);
			return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
		});
	}

	function loadLibrary(src: string): Promise<void> {
		const existing = document.getElementById('adcash-aclib') as HTMLScriptElement | null;
		if (existing) {
			if ((window as AdcashWindow).aclib?.runAutoTag) return Promise.resolve();
			return new Promise((resolve, reject) => {
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', () => reject(new Error('Adcash library failed to load.')), { once: true });
			});
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.id = 'adcash-aclib';
			script.type = 'text/javascript';
			script.async = true;
			script.src = src;
			script.onload = () => resolve();
			script.onerror = () => {
				script.remove();
				reject(new Error('Adcash library failed to load.'));
			};
			document.head.appendChild(script);
		});
	}

	async function runAutoTag(config: AdcashConfig) {
		const zoneId = clean(config.auto_tag?.zone_id);
		if (!zoneId || config.auto_tag?.enabled !== true) return;

		const runtime = window as AdcashWindow;
		runtime.__raksaraAdcashZones ??= new Set<string>();
		if (runtime.__raksaraAdcashZones.has(zoneId)) return;

		const libraryUrl = clean(config.library_url) || DEFAULT_LIBRARY_URL;
		await loadLibrary(libraryUrl);
		if (!runtime.aclib?.runAutoTag) {
			throw new Error('Adcash library loaded without aclib.runAutoTag.');
		}

		runtime.aclib.runAutoTag({ zoneId });
		runtime.__raksaraAdcashZones.add(zoneId);
	}

	onMount(() => {
		let disposed = false;
		let start: (() => void) | null = null;

		void (async () => {
			const siteConfig = await loadConfig(fetch) as AdvertisingSiteConfig;
			const adcash = siteConfig.advertising?.adcash;
			if (disposed || adcash?.enabled !== true || adcash.auto_tag?.enabled !== true) return;
			if (isLocalHost(location.hostname) && adcash.allow_localhost !== true) return;
			if (isExcludedPath(location.pathname, adcash.excluded_paths)) return;

			start = () => {
				for (const eventName of INTERACTION_EVENTS) {
					window.removeEventListener(eventName, start as EventListener, true);
				}
				void runAutoTag(adcash).catch((error) => {
					if (!disposed) console.warn('[advertising] Adcash AutoTag failed:', error);
				});
			};

			if ((adcash.load_strategy ?? 'interaction') === 'immediate') {
				start();
				return;
			}

			if ((navigator as NavigatorWithActivation).userActivation?.hasBeenActive) {
				start();
				return;
			}

			for (const eventName of INTERACTION_EVENTS) {
				window.addEventListener(eventName, start, { once: true, passive: true, capture: true });
			}
		})().catch((error) => {
			if (!disposed) console.warn('[advertising] Adcash configuration failed:', error);
		});

		return () => {
			disposed = true;
			if (!start) return;
			for (const eventName of INTERACTION_EVENTS) {
				window.removeEventListener(eventName, start as EventListener, true);
			}
		};
	});
</script>
