import type { Component } from 'svelte';

/**
 * Heritage Glass shader accents (shaders.com, WebGPU only).
 *
 * Every effect is decorative progressive enhancement: the CSS look underneath is
 * the complete design. The shader chunk is only fetched in the browser, after a
 * cheap WebGPU adapter probe, and never for reduced-motion, reduced-transparency,
 * forced-colors or data-saver visitors.
 */

export type HeritageShaderVariant = 'cover';

type HeritageShaderComponent = Component<{ variant: HeritageShaderVariant; src?: string }>;

let pending: Promise<HeritageShaderComponent | null> | null = null;

function prefersQuietUi(): boolean {
	const media = (query: string) => window.matchMedia?.(query).matches ?? false;
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	return (
		media('(prefers-reduced-motion: reduce)') ||
		media('(prefers-reduced-transparency: reduce)') ||
		media('(forced-colors: active)') ||
		media('(pointer: coarse)') ||
		media('(max-width: 768px)') ||
		connection?.saveData === true
	);
}

async function hasWebGpuAdapter(): Promise<boolean> {
	const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
	if (!gpu) return false;
	try {
		return (await gpu.requestAdapter()) != null;
	} catch {
		return false;
	}
}

/** Resolves the lazily loaded shader component, or null when the visitor should get the CSS look. */
export function loadHeritageShader(): Promise<HeritageShaderComponent | null> {
	if (typeof window === 'undefined' || prefersQuietUi()) return Promise.resolve(null);
	pending ??= (async () => {
		if (!(await hasWebGpuAdapter())) return null;
		if (prefersQuietUi()) { pending = null; return null; }
		const module = await import('$lib/components/HeritageShader.svelte');
		return module.default as HeritageShaderComponent;
	})().catch((error) => {
		console.warn('[heritage] shader accents unavailable, using CSS fallback', error);
		return null;
	});
	return pending;
}
