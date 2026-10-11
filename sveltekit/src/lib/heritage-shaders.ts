import type { Component } from 'svelte';

/**
 * Heritage Glass shader accents (shaders.com, WebGPU only).
 *
 * Every effect is decorative progressive enhancement: the CSS look underneath is
 * the complete design. The shader chunk is only fetched in the browser, after a
 * cheap WebGPU adapter probe, and never for reduced-motion, reduced-transparency,
 * forced-colors or data-saver visitors.
 */

export type HeritageShaderVariant = 'ambient' | 'cover';

export interface HeritagePalette {
	theme: 'dark' | 'light';
	accent: string;
	hi: string;
	lo: string;
	transparent: string;
}

type HeritageShaderComponent = Component<{ variant: HeritageShaderVariant; src?: string }>;

let pending: Promise<HeritageShaderComponent | null> | null = null;

function prefersQuietUi(): boolean {
	const media = (query: string) => window.matchMedia?.(query).matches ?? false;
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	return (
		media('(prefers-reduced-motion: reduce)') ||
		media('(prefers-reduced-transparency: reduce)') ||
		media('(forced-colors: active)') ||
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
	if (typeof window === 'undefined') return Promise.resolve(null);
	pending ??= (async () => {
		if (prefersQuietUi() || !(await hasWebGpuAdapter())) return null;
		const module = await import('$lib/components/HeritageShader.svelte');
		return module.default as HeritageShaderComponent;
	})().catch((error) => {
		console.warn('[heritage] shader accents unavailable, using CSS fallback', error);
		return null;
	});
	return pending;
}

function parseColor(value: string): [number, number, number] | null {
	const v = value.trim();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
	if (hex) {
		const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
		return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
	}
	const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
	return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

const toHex = (rgb: number[]) =>
	'#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
const mix = (a: number[], b: number[], t: number) => a.map((c, i) => c + (b[i] - c) * t);

/** Reads the configured accent from CSS so shaders follow the theme and accent tokens. */
export function readHeritagePalette(): HeritagePalette {
	const root = document.documentElement;
	const theme = root.dataset.theme === 'light' ? 'light' : 'dark';
	const accent = parseColor(getComputedStyle(root).getPropertyValue('--accent')) ?? [212, 165, 116];
	return {
		theme,
		accent: toHex(accent),
		hi: toHex(mix(accent, [255, 247, 230], 0.55)),
		lo: toHex(mix(accent, [20, 12, 6], 0.55)),
		transparent: `${toHex(accent)}00`
	};
}

/** Calls back whenever the theme or accent tokens on <html> change. */
export function watchHeritagePalette(callback: (palette: HeritagePalette) => void): () => void {
	const observer = new MutationObserver(() => callback(readHeritagePalette()));
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
	return () => observer.disconnect();
}
