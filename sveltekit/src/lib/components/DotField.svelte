<script lang="ts">
  /**
   * Full-bleed halftone dot field. Every dot sits on one shared grid that spans
   * the host; dots inside the `anchor` element's box are sized from the portrait
   * image, the rest form a faint ambient grid. Colour comes from `--accent`.
   * Motion: staggered reveal, per-dot twinkle, a slow diagonal glint and a soft
   * pointer lift. Reduced-motion users get a single static frame.
   */
  interface Props {
    src?: string;
    anchor?: HTMLElement | null;
    label?: string;
    className?: string;
  }

  let { src = '', anchor = null, label = '', className = '' }: Props = $props();

  let host: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let ready = $state(false);

  const FRAME_MS = 1000 / 30;
  const ALPHA_LEVELS = 12;

  type Field = {
    width: number;
    height: number;
    spacing: number;
    count: number;
    x: Float32Array;
    y: Float32Array;
    /** 0 = ambient grid dot, (0, 1] = portrait intensity */
    tone: Float32Array;
    phase: Float32Array;
    delay: Float32Array;
  };

  function cssNumber(element: HTMLElement, name: string, fallback: number): number {
    const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /** Deterministic 0..1 hash so twinkle phases are stable across rebuilds. */
  function hash(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  type Crop = { sx: number; sy: number; sw: number; sh: number };
  type Analysis = { backdrop: number; crop: Crop };

  function readLuminance(
    image: HTMLImageElement,
    crop: Crop,
    cols: number,
    rows: number
  ): Float32Array | null {
    const sample = document.createElement('canvas');
    sample.width = cols;
    sample.height = rows;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cols, rows);
    const pixels = ctx.getImageData(0, 0, cols, rows).data;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < lum.length; i += 1) {
      const p = i * 4;
      lum[i] = ((0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255) * (pixels[p + 3] / 255);
    }
    return lum;
  }

  function boxBlur(values: Float32Array, cols: number, rows: number, passes: number): Float32Array {
    let current = values;
    for (let pass = 0; pass < passes; pass += 1) {
      const next = new Float32Array(current.length);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          let sum = 0;
          for (let oy = -1; oy <= 1; oy += 1) {
            const yy = Math.max(0, Math.min(rows - 1, y + oy));
            for (let ox = -1; ox <= 1; ox += 1) {
              sum += current[yy * cols + Math.max(0, Math.min(cols - 1, x + ox))];
            }
          }
          next[y * cols + x] = sum / 9;
        }
      }
      current = next;
    }
    return current;
  }

  /** Subject mask: |lum − backdrop| blurred, so plain backdrops drop out. */
  function subjectMask(lum: Float32Array, backdrop: number, cols: number, rows: number): Float32Array {
    const diff = new Float32Array(lum.length);
    for (let i = 0; i < lum.length; i += 1) diff[i] = Math.abs(lum[i] - backdrop);
    return boxBlur(diff, cols, rows, 2);
  }

  /**
   * Backdrop luminance (median of the image border) and a crop around the
   * subject, so the portrait fills the slot instead of the studio backdrop.
   */
  function analyse(image: HTMLImageElement): Analysis | null {
    const full = { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
    const cols = 96;
    const rows = Math.max(8, Math.round((cols * image.naturalHeight) / image.naturalWidth));
    const lum = readLuminance(image, full, cols, rows);
    if (!lum) return null;

    const border: number[] = [];
    for (let x = 0; x < cols; x += 1) border.push(lum[x]);
    for (let y = 1; y < rows; y += 1) border.push(lum[y * cols], lum[y * cols + cols - 1]);
    border.sort((a, b) => a - b);
    const backdrop = border[Math.floor(border.length / 2)] ?? 0;

    const mask = subjectMask(lum, backdrop, cols, rows);
    let minX = cols;
    let minY = rows;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (mask[y * cols + x] < 0.14) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0 || (maxX - minX) * (maxY - minY) < cols * rows * 0.04) return { backdrop, crop: full };

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.06;
    const scaleX = image.naturalWidth / cols;
    const scaleY = image.naturalHeight / rows;
    const sx = Math.max(0, (minX - padX) * scaleX);
    const sy = Math.max(0, (minY - padY) * scaleY);
    const ex = Math.min(image.naturalWidth, (maxX + 1 + padX) * scaleX);
    const ey = Math.min(image.naturalHeight, (maxY + 1 + padY) * scaleY);
    return { backdrop, crop: { sx, sy, sw: ex - sx, sh: ey - sy } };
  }

  /**
   * Light-on-dark halftone tone per grid dot (bright pixels → big dots), gated
   * by the subject mask and contrast-stretched across the subject's own range.
   * Edge strength keeps dark regions (hair, eyes) legible.
   */
  function toneMap(
    image: HTMLImageElement,
    crop: Crop,
    backdrop: number,
    cols: number,
    rows: number
  ): Float32Array | null {
    const lum = readLuminance(image, crop, cols, rows);
    if (!lum) return null;
    const mask = subjectMask(lum, backdrop, cols, rows);

    const subjectLum: number[] = [];
    for (let i = 0; i < lum.length; i += 1) if (mask[i] > 0.14) subjectLum.push(lum[i]);
    subjectLum.sort((a, b) => a - b);
    const low = subjectLum[Math.floor(subjectLum.length * 0.04)] ?? 0;
    const high = subjectLum[Math.floor(subjectLum.length * 0.96)] ?? 1;
    const range = Math.max(0.1, high - low);
    const local = boxBlur(lum, cols, rows, 3);

    const at = (x: number, y: number) =>
      lum[Math.max(0, Math.min(rows - 1, y)) * cols + Math.max(0, Math.min(cols - 1, x))];
    const tone = new Float32Array(lum.length);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const gx =
          at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gy =
          at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        const index = y * cols + x;
        const subject = smoothstep(0.05, 0.18, mask[index]);
        const stretched = Math.max(0, Math.min(1, (lum[index] - low) / range));
        // Lift midtones (skin) and add a high-pass term so features read at dot scale.
        const detail = (lum[index] - local[index]) / range;
        const light = Math.max(0, Math.min(1, 0.08 + 0.92 * Math.pow(stretched, 0.72) + detail * 1.6));
        const edge = Math.min(1, Math.hypot(gx, gy) * 0.55);
        tone[index] = Math.min(1, subject * Math.max(light, edge * 0.45));
      }
    }
    return tone;
  }

  function buildField(image: HTMLImageElement | null, analysis: Analysis | null): Field | null {
    if (!host) return null;
    const bounds = host.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return null;

    const spacing = bounds.width < 640 ? 6 : 7;
    const cols = Math.ceil(bounds.width / spacing) + 1;
    const rows = Math.ceil(bounds.height / spacing) + 1;
    const originX = (bounds.width - (cols - 1) * spacing) / 2;
    const originY = (bounds.height - (rows - 1) * spacing) / 2;

    // Portrait rect (contain-fit of the subject crop into the anchor slot) and
    // the field columns/rows that fall inside it, so tone aligns 1:1 with dots.
    let portrait: Float32Array | null = null;
    let px = 0;
    let py = 0;
    let pw = 0;
    let ph = 0;
    let c0 = 0;
    let r0 = 0;
    let pCols = 0;
    let pRows = 0;

    if (image && analysis && anchor) {
      const slot = anchor.getBoundingClientRect();
      const { crop } = analysis;
      const ratio = crop.sw / crop.sh;
      pw = slot.width;
      ph = pw / ratio;
      if (ph > slot.height) {
        ph = slot.height;
        pw = ph * ratio;
      }
      px = slot.left - bounds.left + (slot.width - pw) / 2;
      py = slot.top - bounds.top + (slot.height - ph) / 2;
      c0 = Math.max(0, Math.ceil((px - originX) / spacing));
      r0 = Math.max(0, Math.ceil((py - originY) / spacing));
      pCols = Math.min(cols, Math.floor((px + pw - originX) / spacing)) - c0;
      pRows = Math.min(rows, Math.floor((py + ph - originY) / spacing)) - r0;
      if (pCols > 8 && pRows > 8) {
        // Source rect covering exactly the footprint of those dots.
        const left = originX + c0 * spacing - spacing / 2;
        const top = originY + r0 * spacing - spacing / 2;
        const sourceCrop = {
          sx: crop.sx + ((left - px) / pw) * crop.sw,
          sy: crop.sy + ((top - py) / ph) * crop.sh,
          sw: ((pCols * spacing) / pw) * crop.sw,
          sh: ((pRows * spacing) / ph) * crop.sh
        };
        portrait = toneMap(image, sourceCrop, analysis.backdrop, pCols, pRows);
      }
    }

    const total = cols * rows;
    const x = new Float32Array(total);
    const y = new Float32Array(total);
    const tone = new Float32Array(total);
    const phase = new Float32Array(total);
    const delay = new Float32Array(total);
    const centerX = portrait ? px + pw / 2 : bounds.width * 0.7;
    const centerY = portrait ? py + ph / 2 : bounds.height * 0.5;
    const reach = Math.hypot(bounds.width, bounds.height);

    let count = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const dx = originX + col * spacing;
        const dy = originY + row * spacing;
        let t = 0;
        const pc = col - c0;
        const pr = row - r0;
        if (portrait && pc >= 0 && pc < pCols && pr >= 0 && pr < pRows) {
          const u = (dx - px) / pw;
          const v = (dy - py) / ph;
          // Elliptical feather + soft bottom fade so the portrait has no hard box.
          const feather = 1 - smoothstep(0.7, 1.04, Math.hypot((u - 0.5) / 0.5, (v - 0.44) / 0.58));
          const bottom = 1 - smoothstep(0.8, 1, v);
          t = portrait[pr * pCols + pc] * feather * bottom;
          if (t < 0.05) t = 0;
        }
        x[count] = dx;
        y[count] = dy;
        tone[count] = t;
        phase[count] = hash(col, row) * Math.PI * 2;
        delay[count] = (Math.hypot(dx - centerX, dy - centerY) / reach) * 1.1 + hash(row, col) * 0.18;
        count += 1;
      }
    }

    return { width: bounds.width, height: bounds.height, spacing, count, x, y, tone, phase, delay };
  }

  $effect(() => {
    const source = src;
    const slot = anchor;
    if (!host || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let image: HTMLImageElement | null = null;
    let field: Field | null = null;
    let analysis: Analysis | null = null;
    let color = '#22c55e';
    let ambient = 0.1;
    let strength = 1;
    let frame = 0;
    let lastPaint = 0;
    let start = performance.now();
    let visible = true;
    let pointerX = -1e4;
    let pointerY = -1e4;
    let pointerLift = 0;
    let alphaOut = new Float32Array(0);
    let radiusOut = new Float32Array(0);

    const readTheme = () => {
      if (!host) return;
      color = getComputedStyle(host).getPropertyValue('--accent').trim() || color;
      ambient = cssNumber(host, '--dot-field-ambient', 0.1);
      strength = cssNumber(host, '--dot-field-strength', 1);
    };

    const resize = () => {
      if (!host || !canvas) return;
      field = buildField(analysis ? image : null, analysis);
      if (!field) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(field.width * dpr);
      canvas.height = Math.round(field.height * dpr);
      canvas.style.width = `${field.width}px`;
      canvas.style.height = `${field.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      alphaOut = new Float32Array(field.count);
      radiusOut = new Float32Array(field.count);
    };

    const paint = (elapsed: number, animate: boolean) => {
      if (!field) return;
      const { width, height, spacing, count, x, y, tone, phase, delay } = field;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      // Diagonal glint sweeping across the field every ~11s.
      const span = width * 0.8 + height * 0.6;
      const band = Math.max(140, span * 0.12);
      const glintAt = animate ? ((elapsed * span) / 11) % (span + band * 4) - band * 2 : -1e6;
      const pointerRadius2 = 2 * 110 * 110;
      const baseRadius = spacing * 0.1;

      for (let i = 0; i < count; i += 1) {
        const reveal = animate ? smoothstep(0, 1, (elapsed - delay[i]) / 0.7) : 1;
        if (reveal <= 0) {
          alphaOut[i] = 0;
          continue;
        }
        const t = tone[i];
        const d = (x[i] * 0.8 + y[i] * 0.6 - glintAt) / band;
        const glint = Math.exp(-d * d);
        const wave = animate ? Math.sin(elapsed * (t > 0 ? 1.4 : 0.8) + phase[i]) : 0;
        let lift = 0;
        if (pointerLift > 0) {
          const pdx = x[i] - pointerX;
          const pdy = y[i] - pointerY;
          lift = Math.exp(-(pdx * pdx + pdy * pdy) / pointerRadius2) * pointerLift;
        }

        let alpha: number;
        let radius: number;
        if (t > 0) {
          alpha = (0.2 + 0.8 * t) * (0.86 + 0.14 * wave) * strength + glint * 0.18 + lift * 0.2;
          radius = spacing * (0.12 + 0.3 * t) * (1 + glint * 0.12 + lift * 0.18);
        } else {
          alpha = ambient * (0.75 + 0.25 * wave) + glint * ambient * 1.6 + lift * 0.22;
          radius = baseRadius * (1 + glint * 0.6 + lift * 1.4) + 0.45;
        }
        alphaOut[i] = Math.min(1, alpha * reveal);
        radiusOut[i] = radius * (0.4 + 0.6 * reveal);
      }

      // Batch dots into a few alpha levels: one path + fill per level.
      for (let level = 1; level <= ALPHA_LEVELS; level += 1) {
        const lo = (level - 1) / ALPHA_LEVELS;
        const hi = level / ALPHA_LEVELS;
        ctx.globalAlpha = (lo + hi) / 2;
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < count; i += 1) {
          const a = alphaOut[i];
          if (a <= lo || a > hi || a < 0.015) continue;
          const r = radiusOut[i];
          ctx.moveTo(x[i] + r, y[i]);
          ctx.arc(x[i], y[i], r, 0, Math.PI * 2);
          any = true;
        }
        if (any) ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !visible) return;
      if (now - lastPaint >= FRAME_MS) {
        lastPaint = now;
        pointerLift += ((pointerX > -1e3 ? 1 : 0) - pointerLift) * 0.12;
        paint((now - start) / 1000, true);
      }
      frame = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (disposed) return;
      if (reducedMotion.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        paint(0, false);
        return;
      }
      if (!frame && visible) frame = requestAnimationFrame(tick);
    };

    const rebuild = () => {
      readTheme();
      resize();
      if (reducedMotion.matches) paint(0, false);
      ready = Boolean(field);
      schedule();
    };

    let resizeFrame = 0;
    const queueRebuild = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(rebuild);
    };

    if (source) {
      image = new Image();
      image.decoding = 'async';
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (!image) return;
        try {
          analysis = analyse(image);
        } catch (error) {
          // Cross-origin avatars without CORS taint the canvas; keep the ambient field.
          console.warn('[DotField] portrait analysis failed; rendering ambient field only', error);
          analysis = null;
        }
        start = performance.now();
        queueRebuild();
      };
      image.onerror = () => {
        console.warn('[DotField] portrait image failed to load:', source);
        image = null;
        analysis = null;
        queueRebuild();
      };
      image.src = source;
    }
    queueRebuild();

    const resizeObserver = new ResizeObserver(queueRebuild);
    resizeObserver.observe(host);
    if (slot) resizeObserver.observe(slot);

    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (reducedMotion.matches) paint(0, false);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class']
    });

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === 'visible';
      if (visible) schedule();
    });
    intersection.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      if (visible) schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Listen on the hero (host's parent) so the field reacts beneath the copy too.
    const pointerTarget = host.parentElement ?? host;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const onPointerMove = (event: PointerEvent) => {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointerX = -1e4;
      pointerY = -1e4;
    };
    if (finePointer) {
      pointerTarget.addEventListener('pointermove', onPointerMove, { passive: true });
      pointerTarget.addEventListener('pointerleave', onPointerLeave);
    }

    reducedMotion.addEventListener('change', rebuild);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', rebuild);
      if (finePointer) {
        pointerTarget.removeEventListener('pointermove', onPointerMove);
        pointerTarget.removeEventListener('pointerleave', onPointerLeave);
      }
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
    };
  });
</script>

<div
  bind:this={host}
  class="dot-field {className}"
  class:ready
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
  .dot-field {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  canvas {
    display: block;
    opacity: 0;
    transition: opacity 600ms ease;
  }

  .ready canvas {
    opacity: 1;
  }
</style>
