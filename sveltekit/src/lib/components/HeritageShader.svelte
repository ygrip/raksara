<script lang="ts">
	/** Public core API exposes the frame/pixel budgets absent from the Svelte wrapper. */
	import { onMount } from 'svelte';
	import { shaderRendererGPU, rootPassthrough, createGpuUniformsMap } from 'shaders/core';
	import LightLeak from 'shaders/core/LightLeak';
	import Sparkle from 'shaders/core/Sparkle';
	import ImageTexture from 'shaders/core/ImageTexture';
	import SolidColor from 'shaders/core/SolidColor';
	import { readHeritagePalette, watchHeritagePalette, type HeritageShaderVariant } from '$lib/heritage-shaders';

	let { variant, src = '' }: { variant: HeritageShaderVariant; src?: string } = $props();
	let ready = $state(false);
	let unavailable = $state(false);
	let wrapper: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const renderer = shaderRendererGPU();
		let disposed = false;
		let initialized = false;
		let intersecting = true;
		const host = wrapper.parentElement;
		const fail = (reason: unknown) => {
			if (disposed) return;
			unavailable = true;
			ready = false;
			host?.classList.remove('hg-shader-host-ready');
			console.warn('[heritage] shader unavailable, using CSS fallback', reason);
		};
		renderer.setFrameRateCap(24);
		renderer.setOnUnavailable(fail);
		renderer.setOnReady(() => {
			if (disposed) return;
			ready = true;
			host?.classList.add('hg-shader-host-ready');
		});
		const syncVisibility = () => {
			if (!initialized || disposed) return;
			if (intersecting && document.visibilityState === 'visible') renderer.startAnimation();
			else renderer.stopAnimation();
		};
		const visibility = new IntersectionObserver(([entry]) => {
			intersecting = entry.isIntersecting;
			syncVisibility();
		});
		visibility.observe(wrapper);
		document.addEventListener('visibilitychange', syncVisibility);
		const resize = new ResizeObserver(() => {
			if (!initialized || disposed) return;
			renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
		});
		resize.observe(wrapper);

		const paletteProps = () => {
			const palette = readHeritagePalette();
			const dark = palette.theme === 'dark';
			return {
				position: { x: 0.78, y: -0.05 }, spread: dark ? 0.85 : 0.7,
				intensity: dark ? 0.32 : 0.22, streaks: 0.35,
				colorHot: palette.hi, colorMid: palette.accent, colorFringe: palette.lo,
				flicker: 0.18, speed: 0.25, seed: 7
			};
		};
		const stopPalette = watchHeritagePalette(() => {
			if (!initialized || variant !== 'ambient') return;
			for (const [key, value] of Object.entries(paletteProps())) renderer.updateUniformValue('effect', key, value);
			renderer.updateUniformValue('source', 'color', readHeritagePalette().transparent);
		});
		void (async () => {
			try {
				await renderer.initialize({ canvas, colorSpace: 'srgb', toneMapping: 'linear' });
				if (disposed) { renderer.cleanup(); return; }
				if (renderer.getFailureReason()) return;
				initialized = true;
				renderer.setResolutionScale(0.75);
				renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
				renderer.registerNode('root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
				const effect = variant === 'ambient' ? LightLeak : Sparkle;
				const props = variant === 'ambient' ? paletteProps() : {
					size: 64, intensity: 11, threshold: 0.62, expand: 0, rayLength: 9, colorize: 0.6, speed: 0.6, seed: 3
				};
				const source = variant === 'ambient' ? SolidColor : ImageTexture;
				const sourceProps = variant === 'ambient' ? { color: readHeritagePalette().transparent } : { url: src, objectFit: 'cover' };
				// Vendor bridge erases prop types to unknown; its contravariant transform signature
				// rejects its own definitions under strictFunctionTypes despite identical runtime shape.
				renderer.registerNode('effect', effect.fragment, 'root', null, createGpuUniformsMap(effect as Parameters<typeof createGpuUniformsMap>[0], props, 'effect'), effect);
				renderer.registerNode('source', source.fragment, 'effect', null, createGpuUniformsMap(source as Parameters<typeof createGpuUniformsMap>[0], sourceProps, 'source'), source);
				syncVisibility();
			} catch (error) { fail(error); renderer.cleanup(); }
		})();
		return () => {
			disposed = true;
			stopPalette();
			visibility.disconnect();
			resize.disconnect();
			document.removeEventListener('visibilitychange', syncVisibility);
			host?.classList.remove('hg-shader-host-ready');
			renderer.cleanup();
		};
	});
</script>

<div class="hg-shader hg-shader--{variant}" class:is-ready={ready && !unavailable} aria-hidden="true" bind:this={wrapper}>
	<canvas data-renderer="shaders" bind:this={canvas}></canvas>
</div>

<style>
	.hg-shader { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .9s ease; border-radius: inherit; overflow: hidden; }
	.hg-shader.is-ready { opacity: var(--hg-shader-opacity, 1); }
	canvas { display: block; width: 100%; height: 100%; }
	@media print { .hg-shader { display: none; } }
</style>
