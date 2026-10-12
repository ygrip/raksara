<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Ambient accent fireflies behind the glass shell.
   *
   * Each firefly is a pre-rasterised radial gradient that twinkles with one
   * opacity-only Web Animation. Opacity runs on the compositor with no main-
   * thread work; transform drift does not: any IntersectionObserver on the page
   * (lazy images, infinite scroll, the dot field) makes Chrome recompute
   * intersections on the main thread every frame a transform animates.
   * Counts stay small (16 desktop, 6 mobile); positions use a jittered grid
   * so they spread evenly, with a column behind the floating sidebar.
   */
  type Fly = {
    x: string;
    y: string;
    size: number;
    duration: number;
    delay: number;
    peak: number;
    glass: boolean;
  };

  let flies: Fly[] = $state([]);
  let ready = $state(false);

  const between = (min: number, max: number) => min + Math.random() * (max - min);

  /** One firefly per cell, jittered inside the middle 70% of the cell. */
  function grid(cols: number, rows: number, left: string, width: string, glass: boolean): Fly[] {
    const out: Fly[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const u = (col + between(0.15, 0.85)) / cols;
        const v = (row + between(0.15, 0.85)) / rows;
        out.push({
          x: `calc(${left} + ${width} * ${u.toFixed(4)})`,
          y: `${(v * 100).toFixed(2)}%`,
          size: Math.round(glass ? between(72, 110) : between(30, 56)),
          duration: +between(5, 9).toFixed(2),
          delay: -+between(0, 9).toFixed(2),
          peak: +(glass ? between(0.7, 1) : between(0.55, 0.9)).toFixed(2),
          glass
        });
      }
    }
    return out;
  }

  function layout(compact: boolean): Fly[] {
    if (compact) return grid(2, 3, '0px', '100%', false);
    // Desktop: the floating sidebar occupies 12px … (--sidebar-width − 12px).
    const sidebar = 'var(--sidebar-width, 276px)';
    return [
      ...grid(1, 4, '28px', `(${sidebar} - 56px)`, true),
      ...grid(4, 3, sidebar, `(100% - ${sidebar})`, false)
    ];
  }

  /**
   * Twinkle with concrete keyframe numbers. CSS keyframes built from custom
   * properties are resolved on the main thread every frame; plain opacity
   * values stay entirely on the compositor.
   */
  function twinkle(node: HTMLElement, fly: Fly) {
    const { peak } = fly;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.opacity = String(peak * 0.6);
      return {};
    }
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
    return { destroy: () => animation.cancel() };
  }

  onMount(() => {
    const compact = matchMedia('(max-width: 768px)');
    const update = () => {
      flies = layout(compact.matches);
    };
    update();
    compact.addEventListener('change', update);
    // Fade in after the first styled frame instead of popping in.
    const frame = requestAnimationFrame(() => (ready = true));
    return () => {
      cancelAnimationFrame(frame);
      compact.removeEventListener('change', update);
    };
  });
</script>

<div class="fireflies-layer" class:ready aria-hidden="true">
  {#each flies as fly (fly)}
    <span
      class="firefly"
      class:glass={fly.glass}
      style:left={fly.x}
      style:top={fly.y}
      style:--size="{fly.size}px"
      use:twinkle={fly}
    ></span>
  {/each}
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

  /* Light: a white core vanishes on the paper canvas and a dimmed halo turns
     muddy, so use saturated accent "sunlit pollen" with a deeper core. */
  :global(:root[data-theme='light']) .fireflies-layer {
    --ff-core: color-mix(in oklab, var(--accent) 88%, #fff 12%);
    --ff-mid: color-mix(in oklab, var(--accent) 52%, transparent);
    --ff-halo: color-mix(in oklab, var(--accent) 16%, transparent);
    --ff-glass-halo: color-mix(in oklab, var(--accent) 34%, transparent);
    --ff-strength: .82;
  }
  @supports (color: oklch(from red l c h)) {
    :global(:root[data-theme='light']) .fireflies-layer {
      --ff-core: oklch(from var(--accent) clamp(.6, l, .74) max(c, .15) h);
      --ff-mid: oklch(from var(--accent) clamp(.66, l, .8) max(c, .13) h / .5);
      --ff-halo: oklch(from var(--accent) clamp(.74, l, .86) max(c, .1) h / .2);
      --ff-glass-halo: oklch(from var(--accent) clamp(.7, l, .82) max(c, .12) h / .36);
    }
  }

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
