<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[fireflies] Canvas unavailable; keeping the static background.');
      return;
    }
    const preferences = [
      matchMedia('(prefers-reduced-motion: reduce)'),
      matchMedia('(prefers-reduced-transparency: reduce)'),
      matchMedia('(forced-colors: active)')
    ];
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const brush = sprite.getContext('2d');
    if (!brush) return;
    // No Three.js dependency, full-resolution buffers, or per-frame gradients.
    const particles = Array.from({ length: innerWidth < 640 ? 12 : 24 }, () => ({
      x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2,
      speed: 0.003 + Math.random() * 0.005, size: 20 + Math.random() * 24
    }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = true;

    function allowed() {
      return visible && !document.hidden && !connection?.saveData && !preferences.some(p => p.matches);
    }

    function stop() {
      clearTimeout(timer);
      timer = undefined;
    }

    function draw() {
      timer = undefined;
      if (!allowed() || !ctx) return;
      const time = performance.now() / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        const x = (p.x + Math.sin(time * 0.18 + p.phase) * 0.035) * canvas.width;
        const v = ((p.y - time * p.speed) % 1 + 1) % 1;
        const y = v * canvas.height;
        const edge = Math.min(1, v * 10, (1 - v) * 10);
        ctx.globalAlpha = edge * (0.25 + 0.65 * ((Math.sin(time * 0.7 + p.phase) + 1) / 2) ** 2);
        ctx.drawImage(sprite, x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      // A timer, not a 60/120 Hz RAF loop: at most twelve paints per second.
      timer = setTimeout(draw, 1000 / 12);
    }

    function sync() {
      stop();
      if (allowed()) draw();
      else ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    function palette() {
      if (!brush) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b76e00';
      brush.clearRect(0, 0, 64, 64);
      const glow = brush.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, accent);
      glow.addColorStop(0.12, accent);
      glow.addColorStop(1, 'transparent');
      brush.fillStyle = glow;
      brush.fillRect(0, 0, 64, 64);
      brush.fillStyle = '#fff';
      brush.beginPath();
      brush.arc(32, 32, 1.2, 0, Math.PI * 2);
      brush.fill();
      sync();
    }

    function resize() {
      const box = canvas.getBoundingClientRect();
      // CSS bounds the layer to 1200 × 600; intentionally use DPR 1.
      canvas.width = Math.max(1, Math.round(box.width));
      canvas.height = Math.max(1, Math.round(box.height));
      sync();
    }

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    intersection.observe(canvas);
    const themeObserver = new MutationObserver(palette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    document.addEventListener('visibilitychange', sync);
    preferences.forEach(p => p.addEventListener('change', sync));
    resize();
    palette();

    return () => {
      stop();
      sizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      preferences.forEach(p => p.removeEventListener('change', sync));
      canvas.width = canvas.height = 1;
    };
  });
</script>

<canvas bind:this={canvas} class="fireflies-layer" aria-hidden="true"></canvas>

<style>
  .fireflies-layer {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    width: min(1200px, 100%);
    height: min(600px, 70vh);
    pointer-events: none;
    mask-image: linear-gradient(to bottom, #000 80%, transparent);
  }
  @media (prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce), (forced-colors: active) {
    .fireflies-layer { display: none; }
  }
</style>
