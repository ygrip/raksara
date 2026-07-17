<script lang="ts">
	import { onMount } from 'svelte';
	import { loadConfig, metadataUrl } from '$lib/metadata';
	import type { SiteConfig } from '$lib/types';

	interface WebMcpSearchConfig {
		enabled?: boolean;
		name?: string;
		description?: string;
		max_results?: number;
	}

	interface WebMcpConfig {
		enabled?: boolean;
		origin_trial_token?: string;
		search?: WebMcpSearchConfig;
	}

	interface AgenticSiteConfig extends SiteConfig {
		agentic?: {
			enabled?: boolean;
			webmcp?: WebMcpConfig;
		};
	}

	interface WebMcpTool {
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
		execute: (input: Record<string, unknown>) => Promise<string>;
		annotations?: {
			readOnlyHint?: boolean;
			untrustedContentHint?: boolean;
		};
	}

	interface ModelContext {
		registerTool: (
			tool: WebMcpTool,
			options?: { signal?: AbortSignal },
		) => Promise<void> | void;
	}

	type AgenticDocument = Document & { modelContext?: ModelContext };
	type SearchEngine = {
		search: (query: string, options: Record<string, unknown>) => Array<{
			title: string;
			slug: string;
			section: string;
			category?: string;
			score?: number;
		}>;
	};

	let searchEnginePromise: Promise<SearchEngine> | null = null;

	function clamp(value: unknown, min: number, max: number, fallback: number): number {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return fallback;
		return Math.min(max, Math.max(min, Math.floor(parsed)));
	}

	function normalizeToolName(value: unknown): string {
		const normalized = String(value ?? '')
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 64);
		return normalized || 'search_site';
	}

	function resultHref(section: string, slug: string): string {
		if (section === 'blog') return `/blog/post/${slug}/`;
		if (section === 'portfolio') return `/portfolio/${slug}/`;
		if (section === 'pages') return `/${slug}/`;
		if (section === 'gallery') return '/gallery/';
		if (section === 'thoughts') return '/thoughts/';
		return '/';
	}

	function delay(ms: number, signal: AbortSignal): Promise<void> {
		return new Promise((resolve) => {
			if (signal.aborted) {
				resolve();
				return;
			}

			const timer = window.setTimeout(resolve, ms);
			signal.addEventListener(
				'abort',
				() => {
					window.clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
		});
	}

	async function waitForModelContext(
		signal: AbortSignal,
		timeoutMs = 2500,
	): Promise<ModelContext | null> {
		const startedAt = performance.now();

		while (!signal.aborted && performance.now() - startedAt < timeoutMs) {
			const modelContext = (document as AgenticDocument).modelContext;
			if (modelContext?.registerTool) return modelContext;
			await delay(50, signal);
		}

		return null;
	}

	async function loadSearchEngine(): Promise<SearchEngine> {
		if (searchEnginePromise) return searchEnginePromise;

		searchEnginePromise = (async () => {
			const [{ default: MiniSearch }, response] = await Promise.all([
				import('minisearch'),
				fetch(metadataUrl('search-index.json')),
			]);
			if (!response.ok) {
				throw new Error(`Unable to load search index: ${response.status}`);
			}

			const serialized = await response.json();
			return MiniSearch.loadJSON(JSON.stringify(serialized), {
				fields: ['title', 'body', 'tags', 'category'],
				storeFields: ['title', 'slug', 'section', 'category'],
			}) as unknown as SearchEngine;
		})();

		return searchEnginePromise;
	}

	async function registerSearchTool(
		modelContext: ModelContext,
		searchConfig: WebMcpSearchConfig,
		signal: AbortSignal,
	) {
		if (searchConfig.enabled !== true) return;

		const configuredMaximum = clamp(searchConfig.max_results, 1, 20, 10);
		const toolName = normalizeToolName(searchConfig.name);
		const description = String(
			searchConfig.description
				?? 'Search the published articles, projects, and pages on this website. Use it when the user asks to find content or information available on the site.',
		).trim();

		await modelContext.registerTool(
			{
				name: toolName,
				description,
				inputSchema: {
					type: 'object',
					properties: {
						query: {
							type: 'string',
							minLength: 2,
							description: 'The words or topic to search for on the website.',
						},
						limit: {
							type: 'integer',
							minimum: 1,
							maximum: configuredMaximum,
							description: `Maximum number of results to return, up to ${configuredMaximum}.`,
						},
					},
					required: ['query'],
					additionalProperties: false,
				},
				execute: async (input) => {
					const query = String(input.query ?? '').trim();
					if (query.length < 2) {
						return JSON.stringify({ query, count: 0, results: [], error: 'Query must contain at least two characters.' });
					}

					const limit = clamp(input.limit, 1, configuredMaximum, configuredMaximum);
					const engine = await loadSearchEngine();
					const hits = engine.search(query, {
						limit,
						prefix: true,
						fuzzy: 0.2,
					});
					const results = hits.map((hit) => {
						const path = resultHref(hit.section, hit.slug);
						return {
							title: hit.title,
							section: hit.section,
							category: hit.category || undefined,
							url: new URL(path, location.origin).href,
							score: typeof hit.score === 'number' ? Number(hit.score.toFixed(4)) : undefined,
						};
					});

					return JSON.stringify({ query, count: results.length, results });
				},
				annotations: {
					readOnlyHint: true,
					untrustedContentHint: true,
				},
			},
			{ signal },
		);
	}

	onMount(() => {
		const controller = new AbortController();
		let disposed = false;

		void (async () => {
			const config = await loadConfig(fetch) as AgenticSiteConfig;
			const agentic = config.agentic;
			const webmcp = agentic?.webmcp;
			if (disposed || agentic?.enabled !== true || webmcp?.enabled !== true) return;

			const modelContext = await waitForModelContext(controller.signal);
			if (disposed || !modelContext) {
				if (!disposed) console.info('[agentic] WebMCP is unavailable in this browser or audit runtime.');
				return;
			}

			await registerSearchTool(modelContext, webmcp.search ?? {}, controller.signal);
		})().catch((error) => {
			if (!disposed) console.warn('[agentic] WebMCP setup failed:', error);
		});

		return () => {
			disposed = true;
			controller.abort();
		};
	});
</script>
