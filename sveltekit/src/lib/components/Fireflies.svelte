<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Ambient accent fireflies behind the glass shell.
   *
   * Pure CSS compositor animation: each firefly is a pre-rasterised radial
   * gradient that only animates `transform` and `opacity`, so there is no JS
   * frame loop, no canvas upload and no main-thread paint after mount.
   * Positions use a jittered grid (one firefly per cell) so they are spread
   * evenly instead of clumping, with a dedicated column behind the floating
   * sidebar so its frosted glass always has soft light to diffuse.
   */
  type Fly = {
    x: string;
    y: string;
    size: number;
    dx: number;
    dy: number;
    drift: number;
    delay: number;
    pulse: number;
    pulseDelay: number;
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
          // Behind the sidebar's ~26px blur a firefly must be larger to read as bokeh.
          size: Math.round(glass ? between(84, 132) : between(30, 58)),
          dx: Math.round(between(16, 42) * (Math.random() < 0.5 ? -1 : 1)),
          dy: Math.round(between(18, 48) * (Math.random() < 0.5 ? -1 : 1)),
          drift: Math.round(between(16, 28)),
          delay: -Math.round(between(0, 28)),
          pulse: +between(3.8, 7.2).toFixed(2),
          pulseDelay: -+between(0, 7).toFixed(2),
          peak: +(glass ? between(0.75, 1) : between(0.55, 0.9)).toFixed(2),
          glass
        });
      }
    }
    return out;
  }

  function layout(compact: boolean): Fly[] {
    if (compact) return grid(3, 4, '0px', '100%', false);
    // Desktop: the floating sidebar occupies 12px … (--sidebar-width − 12px).
    const sidebar = 'var(--sidebar-width, 276px)';
    return [
      ...grid(1, 6, '28px', `(${sidebar} - 56px)`, true),
      ...grid(5, 4, sidebar, `(100% - ${sidebar})`, false)
    ];
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
  {#each flies as fly, index (index)}
    <span
      class="firefly"
      class:glass={fly.glass}
      style:left={fly.x}
      style:top={fly.y}
      style:--size="{fly.size}px"
      style:--dx="{fly.dx}px"
      style:--dy="{fly.dy}px"
      style:--drift="{fly.drift}s"
      style:--delay="{fly.delay}s"
      style:--pulse="{fly.pulse}s"
      style:--pulse-delay="{fly.pulseDelay}s"
      style:--peak={fly.peak}
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
  .fireflies-layer.ready { opacity: 1; }

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
    will-change: transform, opacity;
    animation:
      firefly-drift var(--drift) ease-in-out var(--delay) infinite alternate,
      firefly-glow var(--pulse) ease-in-out var(--pulse-delay) infinite;
  }
  /* Behind frosted glass: wider core so the blur diffuses it into visible bokeh. */
  .firefly.glass {
    background: radial-gradient(circle closest-side, var(--ff-core) 0 16%, var(--ff-mid) 34%, var(--ff-glass-halo) 58%, transparent 100%);
  }

  @keyframes firefly-drift {
    0% { transform: translate3d(0, 0, 0); }
    35% { transform: translate3d(var(--dx), calc(var(--dy) * -.6), 0); }
    70% { transform: translate3d(calc(var(--dx) * -.4), var(--dy), 0); }
    100% { transform: translate3d(calc(var(--dx) * .5), calc(var(--dy) * -1), 0); }
  }
  @keyframes firefly-glow {
    0%, 100% { opacity: calc(var(--peak) * var(--ff-strength) * .14); }
    45%, 58% { opacity: calc(var(--peak) * var(--ff-strength)); }
  }

  /* Reduced motion keeps a still glow so the glass keeps its depth. */
  @media (prefers-reduced-motion: reduce) {
    .firefly {
      animation: none;
      opacity: calc(var(--peak) * var(--ff-strength) * .6);
    }
  }
  @media (prefers-reduced-transparency: reduce), (forced-colors: active) {
    .fireflies-layer { display: none; }
  }
  :global(body.reading-mode) .fireflies-layer { display: none; }
</style>
