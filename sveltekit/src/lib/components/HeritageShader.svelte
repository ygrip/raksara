<script lang="ts">
	/** Public core API exposes the frame/pixel budgets absent from the Svelte wrapper. */
	import { onMount } from 'svelte';
	import { shaderRendererGPU, rootPassthrough, createGpuUniformsMap } from 'shaders/core';
	import Sparkle from 'shaders/core/Sparkle';
	import ImageTexture from 'shaders/core/ImageTexture';
	import type { HeritageShaderVariant } from '$lib/heritage-shaders';

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
		let rendererReady = false;
		const quietMedia = [
			'(prefers-reduced-motion: reduce)', '(prefers-reduced-transparency: reduce)',
			'(forced-colors: active)', '(pointer: coarse)', '(max-width: 768px)'
		].map((query) => matchMedia(query));
		const host = wrapper.parentElement;
		const fail = (reason: unknown) => {
			if (disposed) return;
			unavailable = true;
			ready = false;
			host?.classList.remove('hg-shader-host-ready');
			console.warn('[heritage] shader unavailable, using CSS fallback', reason);
		};
		renderer.setFrameRateCap(12);
		renderer.setOnUnavailable(fail);
		renderer.setOnReady(() => {
			if (disposed) return;
			rendererReady = true;
			syncVisibility();
		});
		const syncVisibility = () => {
			if (!initialized || disposed) return;
			const quiet = quietMedia.some((media) => media.matches);
			ready = rendererReady && !quiet && !unavailable;
			host?.classList.toggle('hg-shader-host-ready', ready);
			if (intersecting && document.visibilityState === 'visible' && !quiet) renderer.startAnimation();
			else renderer.stopAnimation();
		};
		const visibility = new IntersectionObserver(([entry]) => {
			intersecting = entry.isIntersecting;
			syncVisibility();
		});
		visibility.observe(wrapper);
		document.addEventListener('visibilitychange', syncVisibility);
		for (const media of quietMedia) media.addEventListener('change', syncVisibility);
		const resize = new ResizeObserver(() => {
			if (!initialized || disposed) return;
			renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
		});
		resize.observe(wrapper);

		void (async () => {
			try {
				await renderer.initialize({ canvas, colorSpace: 'srgb', toneMapping: 'linear' });
				if (disposed) { renderer.cleanup(); return; }
				if (renderer.getFailureReason()) return;
				initialized = true;
				renderer.setResolutionScale(0.5);
				renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
				renderer.registerNode('root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
				const effect = Sparkle;
				const props = {
					size: 64, intensity: 11, threshold: 0.62, expand: 0, rayLength: 9, colorize: 0.6, speed: 0.6, seed: 3
				};
				const source = ImageTexture;
				const sourceProps = { url: src, objectFit: 'cover' };
				// Vendor bridge erases prop types to unknown; its contravariant transform signature
				// rejects its own definitions under strictFunctionTypes despite identical runtime shape.
				renderer.registerNode('effect', effect.fragment, 'root', null, createGpuUniformsMap(effect as Parameters<typeof createGpuUniformsMap>[0], props, 'effect'), effect);
				renderer.registerNode('source', source.fragment, 'effect', null, createGpuUniformsMap(source as Parameters<typeof createGpuUniformsMap>[0], sourceProps, 'source'), source);
				syncVisibility();
			} catch (error) { fail(error); renderer.cleanup(); }
		})();
		return () => {
			disposed = true;
			visibility.disconnect();
			resize.disconnect();
			document.removeEventListener('visibilitychange', syncVisibility);
			for (const media of quietMedia) media.removeEventListener('change', syncVisibility);
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
