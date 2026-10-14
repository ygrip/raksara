<script lang="ts">
  import { onMount } from 'svelte';
  import { mixRgb, parseCssColor, rgba, type Rgb } from '$lib/css-color';
  import type { FireflyMessage, FireflyPalette, WorkerFly } from '$lib/fireflies.worker';

  /**
   * Ambient accent fireflies behind the glass shell.
   *
   * Two stages, both off the main thread once running:
   * 1. Immediately: DOM fireflies that twinkle with opacity-only Web
   *    Animations (compositor-only). They cannot drift: a transform animation
   *    with IntersectionObservers on the page makes Chrome recompute
   *    intersections on the main thread every frame.
   * 2. Deferred to an idle slot: the same fireflies drawn by a worker on an
   *    OffscreenCanvas, now wandering as well as glowing. Worker frames go to
   *    the compositor directly, so the drift costs the page nothing. Browsers
   *    without `transferControlToOffscreen` keep stage 1.
   * Counts stay small (16 desktop, 6 mobile); positions use a jittered grid
   * so they spread evenly, with a column behind the floating sidebar.
   */
  type Region = 'sidebar' | 'main' | 'full';
  type Spec = Omit<WorkerFly, 'x' | 'y'> & { u: number; v: number; region: Region; duration: number; delay: number };
  type Placed = Spec & { x: number; y: number };

  let layer: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(0);
  let height = $state(0);
  let sidebar = $state(0);
  let specs: Spec[] = $state([]);
  let ready = $state(false);
  /** Worker canvas has taken over: fade the twinkling DOM layer out. */
  let moving = $state(false);
  /** DOM layer fully faded out and removed. */
  let handedOff = $state(false);

  const between = (min: number, max: number) => min + Math.random() * (max - min);
  const signed = (min: number, max: number) => between(min, max) * (Math.random() < 0.5 ? -1 : 1);

  /** One firefly per cell, jittered inside the middle 70% of the cell. */
  function grid(cols: number, rows: number, region: Region, glass: boolean): Spec[] {
    const out: Spec[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        out.push({
          u: (col + between(0.15, 0.85)) / cols,
          v: (row + between(0.15, 0.85)) / rows,
          region,
          size: Math.round(glass ? between(72, 110) : between(30, 56)),
          duration: +between(5, 9).toFixed(2),
          delay: -+between(0, 9).toFixed(2),
          dx: signed(18, 46),
          dy: signed(20, 52),
          periodX: between(14, 26),
          periodY: between(17, 31),
          pulse: between(4.5, 8.5),
          phase: between(0, Math.PI * 2),
          peak: +(glass ? between(0.7, 1) : between(0.55, 0.9)).toFixed(2),
          glass
        });
      }
    }
    return out;
  }

  function layout(compact: boolean): Spec[] {
    if (compact) return grid(2, 3, 'full', false);
    return [...grid(1, 4, 'sidebar', true), ...grid(4, 3, 'main', false)];
  }

  /** Map normalised cells to px; the floating sidebar spans 12px … (sidebar − 12px). */
  const placed: Placed[] = $derived(specs.map((spec) => {
    const x = spec.region === 'sidebar'
      ? 28 + Math.max(0, sidebar - 56) * spec.u
      : spec.region === 'main' ? sidebar + Math.max(0, width - sidebar) * spec.u : width * spec.u;
    return { ...spec, x, y: height * spec.v };
  }));

  function toWorker(list: Placed[]): WorkerFly[] {
    return list.map(({ x, y, size, dx, dy, periodX, periodY, pulse, phase, peak, glass }) =>
      ({ x, y, size, dx, dy, periodX, periodY, pulse, phase, peak, glass }));
  }

  /** Sprite colours matching the CSS gradients below, for the current theme. */
  function readPalette(): FireflyPalette {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:color-mix(in srgb, var(--accent) 100%, transparent)';
    document.body.append(probe);
    const accent = parseCssColor(getComputedStyle(probe).color, [183, 110, 0]);
    probe.remove();
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const cream: Rgb = [255, 248, 232];
    const pollen = mixRgb(accent, [173, 101, 40], 0.28);
    return light
      ? { core: rgba(pollen), mid: rgba(pollen, 0.42), halo: rgba(pollen, 0.1), glassHalo: rgba(pollen, 0.2) }
      : { core: rgba(mixRgb(accent, cream, 0.7)), mid: rgba(accent, 0.8), halo: rgba(accent, 0.3), glassHalo: rgba(accent, 0.48) };
  }

  /**
   * Twinkle with concrete keyframe numbers. CSS keyframes built from custom
   * properties are resolved on the main thread every frame; plain opacity
   * values stay entirely on the compositor.
   */
  const twinkles = new Map<HTMLElement, { animation: Animation; peak: number }>();

  function syncTwinkles() {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paused = document.visibilityState !== 'visible' || document.body.classList.contains('reading-mode');
    for (const [node, { animation, peak }] of twinkles) {
      if (still) {
        animation.cancel();
        node.style.opacity = String(peak * 0.6);
      } else {
        node.style.removeProperty('opacity');
        if (paused) animation.pause();
        else if (animation.playState !== 'running') animation.play();
      }
    }
  }

  function twinkle(node: HTMLElement, fly: Spec) {
    const { peak } = fly;
    const animation = node.animate(
      [
        { offset: 0, opacity: peak * 0.12 },
        { offset: 0.3, opacity: peak },
        { offset: 0.45, opacity: peak * 0.35 },
        { offset: 0.62, opacity: peak * 0.9 },
        { offset: 1, opacity: peak * 0.18 }
      ],
      { duration: fly.duration * 1000, delay: fly.delay * 1000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
    );
    twinkles.set(node, { animation, peak });
    syncTwinkles();
    return { destroy: () => { animation.cancel(); twinkles.delete(node); } };
  }

  onMount(() => {
    const compact = matchMedia('(max-width: 768px)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const measure = () => {
      if (!layer) return;
      width = layer.clientWidth;
      height = layer.clientHeight;
      sidebar = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 0;
    };
    let worker: Worker | null = null;
    const post = (message: FireflyMessage, transfer: Transferable[] = []) => worker?.postMessage(message, transfer);
    const pushLayout = () => post({ type: 'resize', width, height, flies: toWorker(placed) });
    const relayout = () => {
      measure();
      specs = layout(compact.matches);
      pushLayout();
    };
    relayout();
    compact.addEventListener('change', relayout);
    // Fade in after the first styled frame instead of popping in.
    const frame = requestAnimationFrame(() => (ready = true));

    let disposed = false;
    let cancelIdle = () => {};
    let handoffTimer: ReturnType<typeof setTimeout> | undefined;
    const syncPause = () => {
      syncTwinkles();
      post({ type: document.visibilityState === 'visible' && !document.body.classList.contains('reading-mode') ? 'resume' : 'pause' });
    };
    const syncMotion = () => {
      post({ type: 'motion', still: reducedMotion.matches });
      syncPause();
    };
    const resizeObserver = new ResizeObserver(() => {
      measure();
      pushLayout();
    });
    if (layer) resizeObserver.observe(layer);
    const themeObserver = new MutationObserver(() => post({ type: 'palette', palette: readPalette() }));
    const bodyObserver = new MutationObserver(syncPause);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', syncPause);
    reducedMotion.addEventListener('change', syncMotion);
    syncPause();

    const startDrift = () => {
      if (disposed || !canvas || !('transferControlToOffscreen' in canvas)) return;
      try {
        worker = new Worker(new URL('../fireflies.worker.ts', import.meta.url), { type: 'module' });
        const offscreen = canvas.transferControlToOffscreen();
        post({ type: 'init', canvas: offscreen, width, height, flies: toWorker(placed), palette: readPalette(), still: reducedMotion.matches }, [offscreen]);
      } catch (error) {
        console.warn('[fireflies] Drift unavailable; keeping the twinkle layer.', error);
        worker?.terminate();
        worker = null;
        return;
      }
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
      syncPause();
      moving = true;
      // Remove the DOM twinkles once the crossfade has finished.
      handoffTimer = setTimeout(() => (handedOff = true), 1800);
    };
    // The drift is an enhancement: start it only once the page is idle.
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(startDrift, { timeout: 4000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(startDrift, 2000);
      cancelIdle = () => clearTimeout(id);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelIdle();
      clearTimeout(handoffTimer);
      compact.removeEventListener('change', relayout);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      bodyObserver.disconnect();
      document.removeEventListener('visibilitychange', syncPause);
      reducedMotion.removeEventListener('change', syncMotion);
      for (const { animation } of twinkles.values()) animation.cancel();
      twinkles.clear();
      worker?.terminate();
    };
  });
</script>

<div class="fireflies-layer" class:ready bind:this={layer} aria-hidden="true">
  <canvas class="fireflies-canvas" class:moving bind:this={canvas}></canvas>
  {#if !handedOff}
    <div class="fireflies-twinkle" class:moving>
      {#each placed as fly (fly)}
        <span
          class="firefly"
          class:glass={fly.glass}
          style:left="{fly.x}px"
          style:top="{fly.y}px"
          style:--size="{fly.size}px"
          use:twinkle={fly}
        ></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fireflies-layer {
    /* Dark: luminous cream core inside an accent halo. */
    --ff-core: color-mix(in oklab, var(--accent) 30%, #fff8e8);
    --ff-mid: color-mix(in oklab, var(--accent) 80%, transparent);
    --ff-halo: color-mix(in oklab, var(--accent) 30%, transparent);
    --ff-glass-halo: color-mix(in oklab, var(--accent) 48%, transparent);
    /* Theme strength scales the whole layer, so per-fly keyframes stay plain numbers. */
    --ff-strength: 1;
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
    opacity: 0;
    transition: opacity 1.6s ease;
  }
  .fireflies-layer.ready { opacity: var(--ff-strength); }

  /* Light: warm copper-gold pollen, with tighter, quieter halos on paper.
     sRGB mixing matches the worker palette so the handoff never shifts colour. */
  :global(:root[data-theme='light']) .fireflies-layer {
    --ff-core: color-mix(in srgb, var(--accent) 72%, #ad6528);
    --ff-mid: color-mix(in srgb, var(--ff-core) 42%, transparent);
    --ff-halo: color-mix(in srgb, var(--ff-core) 10%, transparent);
    --ff-glass-halo: color-mix(in srgb, var(--ff-core) 20%, transparent);
    --ff-strength: .72;
  }

  /* Worker canvas: CSS px = canvas px (soft glows need no device-pixel detail). */
  .fireflies-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 1.4s ease;
  }
  .fireflies-canvas.moving { opacity: 1; }
  .fireflies-twinkle {
    position: absolute;
    inset: 0;
    transition: opacity 1.4s ease;
  }
  .fireflies-twinkle.moving { opacity: 0; }

  .firefly {
    position: absolute;
    width: var(--size);
    height: var(--size);
    margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2);
    border-radius: 50%;
    background: radial-gradient(circle closest-side, var(--ff-core) 0 7%, var(--ff-mid) 18%, var(--ff-halo) 45%, transparent 100%);
    opacity: 0;
    will-change: opacity;
  }
  /* Behind the sidebar: wider core so it still reads as soft bokeh. */
  .firefly.glass {
    background: radial-gradient(circle closest-side, var(--ff-core) 0 16%, var(--ff-mid) 34%, var(--ff-glass-halo) 58%, transparent 100%);
  }

  @media (prefers-reduced-transparency: reduce), (forced-colors: active) {
    .fireflies-layer { display: none; }
  }
  :global(body.reading-mode) .fireflies-layer { display: none; }
</style>
