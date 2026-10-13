<script lang="ts">
  import { globeTone, imageTonePixels, morphFrame, morphPairs } from '$lib/dot-field';
  import { mixRgb, parseCssColor, rgba } from '$lib/css-color';
  /**
   * Full-bleed halftone dot field. Every dot sits on one shared grid that spans
   * the host; dots inside the `anchor` element's box are sized from the portrait
   * image, the rest form a faint ambient grid. Colour comes from `--accent`.
   * Motion is limited to reveal, image morphs, theme changes and pointer input.
   * Held images stay still; a single image has no idle frame loop.
   * Reduced-motion users get a single static, non-interactive frame.
   */
  interface Props {
    src?: string;
    images?: string[];
    anchor?: HTMLElement | null;
    label?: string;
    className?: string;
  }

  let { src = '', images = [], anchor = null, label = '', className = '' }: Props = $props();

  let host: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let ready = $state(false);

  /** Animate at the display rate, capped near 60 fps on high-refresh screens. */
  const MIN_FRAME_MS = 1000 / 60 - 2;
  const RIPPLE_SPEED = 520; // px/s
  const RIPPLE_WIDTH = 34; // px, gaussian half-width of the ring
  const RIPPLE_LIFE = 1.3; // s
  const MAX_RIPPLES = 4;
  const ALPHA_LEVELS = 12;
  /** Minimum tone for any dot inside the subject silhouette (see toneMap). */
  const TONE_FLOOR = 0.3;
  /** Share of a morph spent staggering departures; each particle flies the rest. */
  const MORPH_STAGGER = 0.45;
  /** Resting ambient alpha, as a multiple of --dot-field-ambient. */
  const AMBIENT_BASE = 0.8;
  /** Theme switch: the halftone inverts in a wave from the focal centre. */
  const INVERT_MS = 1100;
  /** Width of the inversion wavefront, as a share of the normalised reveal delay. */
  const INVERT_BAND = 0.35;

  type Field = {
    width: number;
    height: number;
    spacing: number;
    cols: number;
    rows: number;
    originX: number;
    originY: number;
    count: number;
    /** Focal centre (portrait/globe), used for reveal and morph bloom. */
    cx: number;
    cy: number;
    x: Float32Array;
    y: Float32Array;
    /** 0 = ambient grid dot, (0, 1] = portrait intensity (light-on-dark) */
    tone: Float32Array;
    /** Ink-on-paper variant for light themes; same array when not invertible. */
    ink: Float32Array;
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

  /** Deterministic 0..1 hash keeps reveal and flight staggering stable. */
  function hash(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  type Crop = { sx: number; sy: number; sw: number; sh: number };
  /** `transparent`: cut-out artwork (logos/SVG) sampled as-is; opaque images
   * go through the photo pipeline (backdrop removal + contrast stretch). */
  type Analysis = { backdrop: number; crop: Crop; transparent: boolean };

  function hasTransparency(image: HTMLImageElement): boolean {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 32;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(image, 0, 0, 32, 32);
    const pixels = ctx.getImageData(0, 0, 32, 32).data;
    for (let p = 3; p < pixels.length; p += 4) if (pixels[p] < 250) return true;
    return false;
  }

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

  /** Preserve transparent silhouettes, including black SVG logos. On opaque
   * light backgrounds, use dark ink rather than rendering a white rectangle. */
  function imageTone(image: HTMLImageElement, crop: Crop, cols: number, rows: number): Float32Array | null {
    const sample = document.createElement('canvas');
    sample.width = cols;
    sample.height = rows;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    // Use destination scaling + canvas clipping. Source-rectangle drawImage
    // crops intrinsic-size-less SVGs inconsistently in Chromium.
    const scaleX = cols / crop.sw;
    const scaleY = rows / crop.sh;
    ctx.drawImage(image, -crop.sx * scaleX, -crop.sy * scaleY,
      image.naturalWidth * scaleX, image.naturalHeight * scaleY);
    const pixels = ctx.getImageData(0, 0, cols, rows).data;
    // Inspect an entirely in-bounds image, not the grid crop: the crop may
    // extend half a cell beyond an opaque image and introduce false alpha.
    const probe = document.createElement('canvas');
    probe.width = probe.height = 32;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return null;
    probeCtx.drawImage(image, 0, 0, 32, 32);
    const fullPixels = probeCtx.getImageData(0, 0, 32, 32).data;
    return imageTonePixels(pixels, fullPixels, 32);
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

  /**
   * Subject silhouette in [0, 1]. Pixels far from the backdrop luminance are
   * subject; backdrop-like pixels are subject too unless they connect to the
   * image border. That fills enclosed regions — skin close to a grey studio
   * backdrop, eye sockets, shadows — which a plain threshold left as holes.
   */
  function subjectMask(lum: Float32Array, backdrop: number, cols: number, rows: number): Float32Array {
    const size = lum.length;
    const diff = new Float32Array(size);
    for (let i = 0; i < size; i += 1) diff[i] = Math.abs(lum[i] - backdrop);
    const contrast = boxBlur(diff, cols, rows, 2);

    // Walls: clearly-not-backdrop cells, dilated one cell to seal thin gaps
    // along soft edges so the flood fill can't leak into the face.
    const wall = new Uint8Array(size);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (contrast[y * cols + x] < 0.09) continue;
        for (let oy = -1; oy <= 1; oy += 1) {
          const yy = y + oy;
          if (yy < 0 || yy >= rows) continue;
          for (let ox = -1; ox <= 1; ox += 1) {
            const xx = x + ox;
            if (xx >= 0 && xx < cols) wall[yy * cols + xx] = 1;
          }
        }
      }
    }

    // Flood the backdrop in from the border through non-wall cells.
    const outside = new Uint8Array(size);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    const seed = (index: number) => {
      if (wall[index] || outside[index]) return;
      outside[index] = 1;
      queue[tail++] = index;
    };
    for (let x = 0; x < cols; x += 1) {
      seed(x);
      seed((rows - 1) * cols + x);
    }
    for (let y = 0; y < rows; y += 1) {
      seed(y * cols);
      seed(y * cols + cols - 1);
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % cols;
      if (x > 0) seed(index - 1);
      if (x < cols - 1) seed(index + 1);
      if (index >= cols) seed(index - cols);
      if (index < size - cols) seed(index + cols);
    }

    // Keep only the largest connected subject region: stray fabric/backdrop
    // patches otherwise show up as floating dot blobs next to the face.
    const label = new Int32Array(size);
    let best = 0;
    let bestSize = 0;
    let next = 0;
    for (let start = 0; start < size; start += 1) {
      if (outside[start] || label[start]) continue;
      next += 1;
      label[start] = next;
      head = 0;
      tail = 0;
      queue[tail++] = start;
      while (head < tail) {
        const index = queue[head++];
        const x = index % cols;
        if (x > 0 && !outside[index - 1] && !label[index - 1]) { label[index - 1] = next; queue[tail++] = index - 1; }
        if (x < cols - 1 && !outside[index + 1] && !label[index + 1]) { label[index + 1] = next; queue[tail++] = index + 1; }
        if (index >= cols && !outside[index - cols] && !label[index - cols]) { label[index - cols] = next; queue[tail++] = index - cols; }
        if (index < size - cols && !outside[index + cols] && !label[index + cols]) { label[index + cols] = next; queue[tail++] = index + cols; }
      }
      if (tail > bestSize) {
        bestSize = tail;
        best = next;
      }
    }

    const solid = new Float32Array(size);
    for (let i = 0; i < size; i += 1) solid[i] = best > 0 && label[i] === best ? 1 : 0;
    return boxBlur(solid, cols, rows, 1);
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
        if (mask[y * cols + x] < 0.5) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0 || (maxX - minX) * (maxY - minY) < cols * rows * 0.04) return { backdrop, crop: full, transparent: false };

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.06;
    const scaleX = image.naturalWidth / cols;
    const scaleY = image.naturalHeight / rows;
    const sx = Math.max(0, (minX - padX) * scaleX);
    const sy = Math.max(0, (minY - padY) * scaleY);
    const ex = Math.min(image.naturalWidth, (maxX + 1 + padX) * scaleX);
    const ey = Math.min(image.naturalHeight, (maxY + 1 + padY) * scaleY);
    return { backdrop, crop: { sx, sy, sw: ex - sx, sh: ey - sy }, transparent: false };
  }

  /**
   * Light-on-dark halftone tone per grid dot (bright pixels → big dots), gated
   * by the solid subject silhouette and contrast-stretched across the subject's
   * own range. A tone floor keeps every subject dot visible, so dark features
   * (hair, eyes, beard) read as smaller dots instead of holes in the face.
   */
  function toneMap(
    image: HTMLImageElement,
    crop: Crop,
    backdrop: number,
    cols: number,
    rows: number
  ): { tone: Float32Array; ink: Float32Array } | null {
    const lum = readLuminance(image, crop, cols, rows);
    if (!lum) return null;
    const mask = subjectMask(lum, backdrop, cols, rows);

    const subjectLum: number[] = [];
    for (let i = 0; i < lum.length; i += 1) if (mask[i] > 0.5) subjectLum.push(lum[i]);
    subjectLum.sort((a, b) => a - b);
    const low = subjectLum[Math.floor(subjectLum.length * 0.04)] ?? 0;
    const high = subjectLum[Math.floor(subjectLum.length * 0.96)] ?? 1;
    const range = Math.max(0.1, high - low);
    const local = boxBlur(lum, cols, rows, 3);

    const at = (x: number, y: number) =>
      lum[Math.max(0, Math.min(rows - 1, y)) * cols + Math.max(0, Math.min(cols - 1, x))];
    const tone = new Float32Array(lum.length);
    const ink = new Float32Array(lum.length);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const gx =
          at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gy =
          at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        const index = y * cols + x;
        const subject = smoothstep(0.15, 0.85, mask[index]);
        const stretched = Math.max(0, Math.min(1, (lum[index] - low) / range));
        // Lift midtones (skin) and add a high-pass term so features read at dot scale.
        const detail = (lum[index] - local[index]) / range;
        const light = Math.max(0, Math.min(1, 0.04 + 0.96 * Math.pow(stretched, 0.95) + detail * 2.4));
        const edge = Math.min(1, Math.hypot(gx, gy) * 0.55);
        tone[index] = subject * (TONE_FLOOR + (1 - TONE_FLOOR) * Math.min(1, Math.max(light, edge * 0.35)));
        // Light themes print like ink on paper: hair, eyes and shadows carry the
        // large dots instead of rendering the face as a photographic negative.
        const dark = Math.pow(Math.max(0, Math.min(1, 1.04 - light)), 0.9);
        ink[index] = subject * (TONE_FLOOR + (1 - TONE_FLOOR) * Math.min(1, Math.max(dark, edge * 0.35)));
      }
    }
    return { tone, ink };
  }

  function buildField(image: HTMLImageElement | null, analysis: Analysis | null): Field | null {
    if (!host) return null;
    const bounds = host.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return null;

    // Bound the number of cells the portrait analyses and repaints on every frame.
    // A slightly wider grid retains the silhouette while reducing O(cols * rows) work.
    const spacing = bounds.width < 640 ? 8 : 7.5;
    const cols = Math.ceil(bounds.width / spacing) + 1;
    const rows = Math.ceil(bounds.height / spacing) + 1;
    const originX = (bounds.width - (cols - 1) * spacing) / 2;
    const originY = (bounds.height - (rows - 1) * spacing) / 2;

    // Portrait rect (contain-fit of the subject crop into the anchor slot) and
    // the field columns/rows that fall inside it, so tone aligns 1:1 with dots.
    let portrait: Float32Array | null = null;
    let portraitInk: Float32Array | null = null;
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
        if (analysis.transparent) {
          // Cut-out artwork already keeps its own ink/shape; don't invert it.
          portrait = imageTone(image, sourceCrop, pCols, pRows);
          portraitInk = portrait;
        } else {
          const maps = toneMap(image, sourceCrop, analysis.backdrop, pCols, pRows);
          portrait = maps?.tone ?? null;
          portraitInk = maps?.ink ?? null;
        }
        // Feather the rectangular subject once per layout, if sampling succeeded.
        for (let row = 0; portrait && row < pRows; row++) {
          const v = row / (pRows - 1);
          const fadeY = smoothstep(0, 0.08, v) * smoothstep(0, 0.08, 1 - v);
          for (let col = 0; col < pCols; col++) {
            const u = col / (pCols - 1);
            const fade = fadeY * smoothstep(0, 0.1, u) * smoothstep(0, 0.1, 1 - u);
            portrait[row * pCols + col] *= fade;
            if (portraitInk && portraitInk !== portrait) portraitInk[row * pCols + col] *= fade;
          }
        }
      }
    }

    const total = cols * rows;
    const x = new Float32Array(total);
    const y = new Float32Array(total);
    const tone = new Float32Array(total);
    const invertible = Boolean(portrait && portraitInk && portraitInk !== portrait);
    const ink = invertible ? new Float32Array(total) : tone;
    const delay = new Float32Array(total);
    const slot = anchor?.getBoundingClientRect();
    const centerX = portrait ? px + pw / 2 : slot ? slot.left - bounds.left + slot.width / 2 : bounds.width * 0.7;
    const centerY = portrait ? py + ph / 2 : slot ? slot.top - bounds.top + slot.height / 2 : bounds.height * 0.5;
    const globeRadius = Math.min(slot?.width ?? bounds.width * 0.5, slot?.height ?? bounds.height * 0.8) * 0.44;
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
          // Always dissolve the sampled image through a focal envelope. The morph
          // path used to bypass this for `fullImage`, exposing the rectangular image
          // bounds during transitions. Keep the centre dense, then feather naturally
          // into the ambient field on every side.
          const radial = Math.hypot((u - 0.5) / 0.52, (v - 0.45) / 0.62);
          const feather = 1 - smoothstep(0.62, 1.08, radial);
          const bottom = 1 - smoothstep(0.84, 1.03, v);
          const envelope = feather * bottom;
          t = portrait[pr * pCols + pc] * envelope;
          if (t < 0.05) t = 0;
          if (invertible && portraitInk) {
            const k = portraitInk[pr * pCols + pc] * envelope;
            ink[count] = k < 0.05 ? 0 : k;
          }
        } else if (!portrait) {
          t = globeTone((dx - centerX) / globeRadius, (dy - centerY) / globeRadius);
        }
        x[count] = dx;
        y[count] = dy;
        tone[count] = t;
        delay[count] = (Math.hypot(dx - centerX, dy - centerY) / reach) * 1.1 + hash(row, col) * 0.18;
        count += 1;
      }
    }

    return {
      width: bounds.width, height: bounds.height, spacing, cols, rows, originX, originY, count,
      cx: centerX, cy: centerY, x, y, tone, ink, delay
    };
  }

  $effect(() => {
    const sources = images.length ? images : src ? [src] : [];
    const slot = anchor;
    if (!host || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowPower = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const canAnimate = () => !reducedMotion.matches;
    let disposed = false;
    const loaded: Array<{ image: HTMLImageElement; analysis: Analysis }> = [];
    const pendingImages: HTMLImageElement[] = [];
    const loadTimers: Array<ReturnType<typeof setTimeout>> = [];
    let field: Field | null = null;
    let toneFrames: Float32Array[] = [];
    /** Light-on-dark and ink-on-paper tones per image; `toneFrames` holds the target. */
    let toneSets: Array<{ base: Float32Array; ink: Float32Array }> = [];
    const lightTheme = () => document.documentElement.getAttribute('data-theme') === 'light';
    let inkTarget = lightTheme();
    /** Frames on screen when an inversion started, and the per-paint blend. */
    let invertFrom: Float32Array[] = [];
    let blendFrames: Float32Array[] = [];
    let invertStart = -Infinity;
    const invertProgress = (now: number) => (now - invertStart) / INVERT_MS;
    let color = '#22c55e';
    /** Fill per alpha level: saturated body tone ramping to the highlight. */
    let palette: string[] = [];
    /** Region painted by the previous animated frame; null forces a full repaint. */
    let prevBox: [number, number, number, number] | null = null;
    /** Subject cells touched by the running inversion, per tone frame. */
    let invertCells: Int32Array[] = [];
    const invertLit = (index: number) => invertCells[index] ?? litBase;
    /** Images settled (or none configured): only then fade the field in. */
    let settled = sources.length === 0;
    let ambient = 0.1;
    let strength = 1;
    let frame = 0;
    let wakeTimer: ReturnType<typeof setTimeout> | 0 = 0;
    let lastPaint = 0;
    let start = performance.now();
    let visible = true;
    let inViewport = true;
    let dirty = true;
    let paintedImage = -1;
    let wasMoving = false;
    // Interaction: a smoothed pointer (mouse or touch) pushes nearby dots
    // outward and lights them up; taps/clicks emit an expanding ripple.
    let pointerX = -1e4;
    let pointerY = -1e4;
    let targetX = -1e4;
    let targetY = -1e4;
    let pointerActive = false;
    let pointerLift = 0;
    const ripples: Array<{ x: number; y: number; t: number }> = [];
    // Shaded dots are packed into these buffers: lit/interactive grid cells
    // plus travelling morph particles (at most one per lit cell) ≤ 2 × count.
    let alphaOut = new Float32Array(0);
    let radiusOut = new Float32Array(0);
    let drawX = new Float32Array(0);
    let drawY = new Float32Array(0);
    let order = new Int32Array(0);
    const levelCount = new Int32Array(ALPHA_LEVELS + 1);
    const levelStart = new Int32Array(ALPHA_LEVELS + 1);
    /** Per-cell paint stamp so a cell is shaded at most once per frame. */
    let stamp = new Uint32Array(0);
    let paintId = 0;
    /** Lit cell indices per tone frame (index -1 = globe/base tone). */
    let litFrames: Int32Array[] = [];
    let litBase = new Int32Array(0);
    /** Pre-rendered resting ambient grid; redrawn on resize/theme change only. */
    const ambientLayer = document.createElement('canvas');
    const ambientCtx = ambientLayer.getContext('2d');
    let dpr = 1;
    type Flight = {
      src: Int32Array;
      dst: Int32Array;
      /** 0..1 departure lag: diagonal sweep plus jitter. */
      lag: Float32Array;
      /** Signed arc bow, as a fraction of travel distance. */
      curl: Float32Array;
      /** Outward bloom offset (px) at mid-flight. */
      bloomX: Float32Array;
      bloomY: Float32Array;
    };
    const flights = new Map<string, Flight>();

    const flightFor = (from: number, to: number): Flight | null => {
      if (!field) return null;
      const key = `${from}>${to}`;
      const cached = flights.get(key);
      if (cached) return cached;
      const { x, y, cx, cy, spacing } = field;
      const { src, dst } = morphPairs(toneFrames[from], toneFrames[to], field.cols);
      const n = src.length;
      const lag = new Float32Array(n);
      const curl = new Float32Array(n);
      const bloomX = new Float32Array(n);
      const bloomY = new Float32Array(n);
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < n; k += 1) {
        lag[k] = (x[src[k]] + x[dst[k]]) * 0.4 + (y[src[k]] + y[dst[k]]) * 0.3;
        lo = Math.min(lo, lag[k]);
        hi = Math.max(hi, lag[k]);
      }
      // Alternate swirl direction per transition so the loop doesn't feel mechanical.
      const sign = from % 2 ? -1 : 1;
      for (let k = 0; k < n; k += 1) {
        lag[k] = 0.75 * ((lag[k] - lo) / Math.max(1, hi - lo)) + 0.25 * hash(k * 0.37, from + 1.3);
        curl[k] = sign * (0.14 + 0.22 * hash(k * 0.71, to + 2.1));
        const mx = (x[src[k]] + x[dst[k]]) / 2 - cx;
        const my = (y[src[k]] + y[dst[k]]) / 2 - cy;
        const length = Math.hypot(mx, my);
        const angle = length > 1 ? Math.atan2(my, mx) : hash(k, 5.7) * Math.PI * 2;
        const bloom = spacing * (1.5 + 4 * hash(k * 1.13, 9.1));
        bloomX[k] = Math.cos(angle) * bloom;
        bloomY[k] = Math.sin(angle) * bloom;
      }
      const flight = { src, dst, lag, curl, bloomX, bloomY };
      flights.set(key, flight);
      return flight;
    };

    const litCells = (tone: Float32Array) => {
      const cells: number[] = [];
      for (let i = 0; i < tone.length; i += 1) if (tone[i] > 0) cells.push(i);
      return Int32Array.from(cells);
    };

    /** Point the held/morph frames at the current theme's tone variant. */
    const applyTarget = () => {
      toneFrames = toneSets.map((set) => (inkTarget ? set.ink : set.base));
      litFrames = toneFrames.map(litCells);
      litBase = field ? litCells(inkTarget ? field.ink : field.tone) : new Int32Array(0);
      flights.clear();
    };

    /** Blend old → new tones; each dot flips once the wavefront reaches it. */
    const blendInversion = (q: number) => {
      if (!field) return;
      const { delay, count } = field;
      for (let k = 0; k < toneFrames.length; k += 1) {
        const from = invertFrom[k];
        const to = toneFrames[k];
        let out = blendFrames[k];
        if (!out || out.length !== count) out = blendFrames[k] = new Float32Array(count);
        for (let i = 0; i < count; i += 1) {
          const m = smoothstep(0, 1, (q * (1 + INVERT_BAND) - delay[i] / 1.28) / INVERT_BAND);
          out[i] = from[i] + (to[i] - from[i]) * m;
        }
      }
    };

    const drawAmbientLayer = () => {
      if (!field || !ambientCtx) return;
      const { width, height, spacing, originX, originY } = field;
      ambientLayer.width = Math.round(width * dpr);
      ambientLayer.height = Math.round(height * dpr);
      // The resting grid is uniform: rasterise a 2×2-cell tile once at device
      // resolution and fill the layer with it, instead of tracing every dot.
      const tilePx = Math.max(1, Math.round(spacing * 2 * dpr));
      const tile = document.createElement('canvas');
      tile.width = tile.height = tilePx;
      const tileCtx = tile.getContext('2d');
      ambientCtx.setTransform(1, 0, 0, 1, 0, 0);
      ambientCtx.clearRect(0, 0, ambientLayer.width, ambientLayer.height);
      if (!tileCtx) return;
      const cell = tilePx / 2;
      const r = (spacing * 0.1 + 0.45) * dpr;
      tileCtx.fillStyle = palette[1] ?? color;
      tileCtx.beginPath();
      for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const px = cell * (cx + 0.5);
        const py = cell * (cy + 0.5);
        tileCtx.moveTo(px + r, py);
        tileCtx.arc(px, py, r, 0, Math.PI * 2);
      }
      tileCtx.fill();
      const pattern = ambientCtx.createPattern(tile, 'repeat');
      if (!pattern) return;
      // Align tile cell centres with grid points (originX + col × spacing).
      const scale = (spacing * 2 * dpr) / tilePx;
      pattern.setTransform(new DOMMatrix()
        .translate((originX - spacing / 2) * dpr, (originY - spacing / 2) * dpr)
        .scale(scale));
      ambientCtx.globalAlpha = Math.min(1, ambient * AMBIENT_BASE);
      ambientCtx.fillStyle = pattern;
      ambientCtx.fillRect(0, 0, ambientLayer.width, ambientLayer.height);
      prevBox = null;
    };

    const readTheme = () => {
      if (!host) return;
      // `--dot-field-color` (host `color`) is the saturated body tone and
      // `--dot-field-hot` (host `outline-color`) the highlight; brighter dots
      // shift toward the highlight so the portrait reads as lit, not flat.
      // The host CSS normalises both to sRGB, so no canvas readback is needed.
      const style = getComputedStyle(host);
      const base = parseCssColor(style.color, [34, 197, 94]);
      const hot = parseCssColor(style.outlineColor, base);
      color = rgba(base);
      palette = Array.from({ length: ALPHA_LEVELS + 1 }, (_, level) => {
        // Body stays saturated; only the brightest ~40% of dots warm toward the
        // highlight (capped at 70%), so the portrait glows without washing out.
        const f = 0.7 * Math.max(0, (level / ALPHA_LEVELS - 0.6) / 0.4) ** 1.5;
        return rgba(mixRgb(base, hot, f));
      });
      ambient = cssNumber(host, '--dot-field-ambient', 0.1);
      strength = cssNumber(host, '--dot-field-strength', 1);
    };

    // Later images are sampled one per idle slot so the first frame never pays
    // for every portrait at once; the morph loop starts when the second lands.
    let fieldGeneration = 0;
    let cancelExtraField = () => {};
    const queueExtraFields = (generation: number, next: number) => {
      if (disposed || generation !== fieldGeneration || next >= loaded.length) return;
      const run = () => {
        if (disposed || generation !== fieldGeneration) return;
        const extra = buildField(loaded[next].image, loaded[next].analysis);
        if (extra && field && extra.count === field.count) {
          toneSets.push({ base: extra.tone, ink: extra.ink });
          applyTarget();
          schedule();
        }
        queueExtraFields(generation, next + 1);
      };
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(run, { timeout: 1200 });
        cancelExtraField = () => window.cancelIdleCallback(id);
      } else {
        const id = setTimeout(run, 60);
        cancelExtraField = () => clearTimeout(id);
      }
    };

    const resize = () => {
      if (!host || !canvas) return;
      cancelExtraField();
      fieldGeneration += 1;
      const first = loaded[0];
      field = first ? buildField(first.image, first.analysis) : buildField(null, null);
      if (!field) return;
      toneSets = first ? [{ base: field.tone, ink: field.ink }] : [];
      // Arrays are resized; an in-flight inversion can't blend across layouts.
      invertStart = -Infinity;
      blendFrames = [];
      dpr = lowPower.matches ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(field.width * dpr);
      canvas.height = Math.round(field.height * dpr);
      canvas.style.width = `${field.width}px`;
      canvas.style.height = `${field.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      alphaOut = new Float32Array(field.count * 2);
      radiusOut = new Float32Array(field.count * 2);
      drawX = new Float32Array(field.count * 2);
      drawY = new Float32Array(field.count * 2);
      order = new Int32Array(field.count * 2);
      stamp = new Uint32Array(field.count);
      applyTarget();
      drawAmbientLayer();
      queueExtraFields(fieldGeneration, 1);
    };

    const paint = (elapsed: number, animate: boolean, now = performance.now()) => {
      if (!field) return;
      const { width, height, spacing, cols, rows, originX, originY, count, x, y, tone, ink } = field;
      if (!animate) {
        ctx.clearRect(0, 0, width, height);
        prevBox = null;
      }
      ctx.fillStyle = color;

      const pointerRadius = Math.max(80, Math.min(110, width * 0.08));
      const pointerRadius2 = 2 * pointerRadius * pointerRadius;
      const reach2 = pointerRadius2 * 2.5; // lift < 8% beyond; skip those dots
      const push = spacing * 1.6;
      const baseRadius = spacing * 0.1;
      const morph = morphFrame(animate ? elapsed : 0, toneFrames.length);
      const flight = morph.progress > 0 ? flightFor(morph.from, morph.to) : null;
      // While particles fly the grid underneath is ambient only; at rest it
      // shows the held image, so both ends of a flight are seamless.
      const inversion = invertProgress(now);
      const inverting = animate && inversion < 1 && toneFrames.length > 0 && invertFrom.length === toneFrames.length;
      if (inverting) blendInversion(inversion);
      const shownFrames = inverting ? blendFrames : toneFrames;
      const gridTone = flight ? null : (shownFrames[morph.from] ?? (inkTarget ? ink : tone));
      // An inversion only changes subject cells: shade the union of old and new.
      const gridLit = flight ? null : inverting ? invertLit(morph.from) : (litFrames[morph.from] ?? litBase);
      // Only the static (reduced-motion) frame shades the whole grid. Animated
      // frames reuse the cached ambient layer and shade lit, near-pointer,
      // rippled and flying dots: a few thousand instead of every cell. The
      // entrance is a one-shot CSS reveal, not per-dot JS frames.
      const full = !animate;
      const pointerOn = pointerLift > 0.002;
      const reach = Math.sqrt(reach2);

      // Drop finished ripples; each lives RIPPLE_LIFE seconds.
      for (let r = ripples.length - 1; r >= 0; r -= 1) {
        if ((now - ripples[r].t) / 1000 > RIPPLE_LIFE) ripples.splice(r, 1);
      }

      let total = 0;
      /** Shade one dot drawn at (bx, by); `energy` (0..1) marks a dot in flight. */
      const shade = (bx: number, by: number, t: number, energy: number) => {
        const slot = total;
        total += 1;
        drawX[slot] = bx;
        drawY[slot] = by;
        const occupancy = smoothstep(0, 0.12, t);

        let lift = 0;
        if (pointerOn) {
          const pdx = bx - pointerX;
          const pdy = by - pointerY;
          const d2 = pdx * pdx + pdy * pdy;
          if (d2 < reach2) {
            lift = Math.exp(-d2 / pointerRadius2) * pointerLift;
            // Push outward, strongest mid-radius so the cursor centre stays readable.
            const dist = Math.sqrt(d2) || 1;
            const shove = lift * push * Math.min(1, dist / (pointerRadius * 0.35));
            drawX[slot] += (pdx / dist) * shove;
            drawY[slot] += (pdy / dist) * shove;
          }
        }

        let ring = 0;
        for (let r = 0; r < ripples.length; r += 1) {
          const ripple = ripples[r];
          const age = (now - ripple.t) / 1000;
          const rdx = bx - ripple.x;
          const rdy = by - ripple.y;
          const off = (Math.sqrt(rdx * rdx + rdy * rdy) - age * RIPPLE_SPEED) / RIPPLE_WIDTH;
          if (off > -3 && off < 3) ring += Math.exp(-off * off) * (1 - age / RIPPLE_LIFE);
        }
        ring = Math.min(1, ring);

        // Blend occupancy too: switching at t > 0 would make faint subject dots
        // pop between ambient and subject. Resting dots match the cached layer.
        const ambientAlpha = ambient * AMBIENT_BASE + lift * 0.32 + ring * 0.38;
        const subjectAlpha = (0.16 + 0.84 * t) * strength + lift * 0.35 + ring * 0.45 + energy * 0.16;
        const ambientRadius = baseRadius * (1 + lift * 1.9 + ring * 2.2) + 0.45;
        // Wider radius range adds depth: shadow/detail dots stay finer while
        // highlights carry more visual weight. In-flight dots tighten into sparks.
        const subjectRadius = spacing * (0.08 + 0.4 * t) * (1 + lift * 0.35 + ring * 0.45) * (1 - 0.18 * energy);
        const alpha = ambientAlpha + (subjectAlpha - ambientAlpha) * occupancy;
        const radius = ambientRadius + (subjectRadius - ambientRadius) * occupancy;
        alphaOut[slot] = Math.min(1, alpha);
        radiusOut[slot] = Math.min(spacing * 0.48, radius);
      };
      paintId += 1;
      const cell = (i: number) => {
        if (stamp[i] === paintId) return;
        stamp[i] = paintId;
        shade(x[i], y[i], gridTone ? gridTone[i] : 0, 0);
      };
      /** Shade every cell whose centre lies within `radius` of (px, py). */
      const cellsNear = (px: number, py: number, radius: number, inner = 0) => {
        const c0 = Math.max(0, Math.floor((px - radius - originX) / spacing));
        const c1 = Math.min(cols - 1, Math.ceil((px + radius - originX) / spacing));
        const r0 = Math.max(0, Math.floor((py - radius - originY) / spacing));
        const r1 = Math.min(rows - 1, Math.ceil((py + radius - originY) / spacing));
        const outer2 = radius * radius;
        const inner2 = inner > 0 ? inner * inner : -1;
        for (let row = r0; row <= r1; row += 1) {
          for (let col = c0; col <= c1; col += 1) {
            const i = row * cols + col;
            const dx = x[i] - px;
            const dy = y[i] - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < outer2 && d2 > inner2) cell(i);
          }
        }
      };

      if (full) {
        for (let i = 0; i < count; i += 1) cell(i);
      } else {
        // Ambient grid + clearing happen after shading, limited to the dirty region.
        if (gridLit) for (let k = 0; k < gridLit.length; k += 1) cell(gridLit[k]);
        if (pointerOn) cellsNear(pointerX, pointerY, reach);
        for (let r = 0; r < ripples.length; r += 1) {
          const front = ((now - ripples[r].t) / 1000) * RIPPLE_SPEED;
          cellsNear(ripples[r].x, ripples[r].y, front + RIPPLE_WIDTH * 3, front - RIPPLE_WIDTH * 3);
        }
      }

      if (flight) {
        // Each particle leaves its source dot on a staggered schedule, bows out
        // along a curved path and lands exactly on its destination dot (same
        // tone and size as the next held frame).
        const fromTone = toneFrames[morph.from];
        const toTone = toneFrames[morph.to];
        const { src, dst, lag, curl, bloomX, bloomY } = flight;
        for (let k = 0; k < src.length; k += 1) {
          const s = src[k];
          const d = dst[k];
          const p = smoothstep(0, 1, (morph.progress - lag[k] * MORPH_STAGGER) / (1 - MORPH_STAGGER));
          const arc = Math.sin(Math.PI * p);
          const dx = x[d] - x[s];
          const dy = y[d] - y[s];
          shade(
            x[s] + dx * p - dy * curl[k] * arc + bloomX[k] * arc,
            y[s] + dy * p + dx * curl[k] * arc + bloomY[k] * arc,
            fromTone[s] + (toTone[d] - fromTone[s]) * p,
            arc
          );
        }
      }

      if (!full) {
        // Repaint only where dots are this frame or were last frame: during a
        // morph that is the portrait area, not the full-bleed hero canvas.
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let i = 0; i < total; i += 1) {
          const r = radiusOut[i] + 1;
          if (drawX[i] - r < x0) x0 = drawX[i] - r;
          if (drawY[i] - r < y0) y0 = drawY[i] - r;
          if (drawX[i] + r > x1) x1 = drawX[i] + r;
          if (drawY[i] + r > y1) y1 = drawY[i] + r;
        }
        if (pointerOn) {
          x0 = Math.min(x0, pointerX - reach);
          y0 = Math.min(y0, pointerY - reach);
          x1 = Math.max(x1, pointerX + reach);
          y1 = Math.max(y1, pointerY + reach);
        }
        // x0..y1 stay ±Infinity when nothing was drawn: an empty box that unions cleanly.
        const region = prevBox === null
          ? [0, 0, width, height]
          : [Math.min(x0, prevBox[0]), Math.min(y0, prevBox[1]), Math.max(x1, prevBox[2]), Math.max(y1, prevBox[3])];
        // Snap outward to whole pixels so antialiased dot edges are fully cleared.
        const rx = Math.max(0, Math.floor(region[0]) - 1);
        const ry = Math.max(0, Math.floor(region[1]) - 1);
        const rw = Math.min(width, Math.ceil(region[2]) + 1) - rx;
        const rh = Math.min(height, Math.ceil(region[3]) + 1) - ry;
        prevBox = [x0, y0, x1, y1];
        if (rw > 0 && rh > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.clearRect(rx, ry, rw, rh);
          if (pointerOn) {
            // Dots inside the pointer disc are displaced and shaded live.
            ctx.beginPath();
            ctx.rect(rx, ry, rw, rh);
            ctx.arc(pointerX, pointerY, reach, 0, Math.PI * 2, true);
            ctx.clip('evenodd');
          }
          ctx.drawImage(ambientLayer, rx * dpr, ry * dpr, rw * dpr, rh * dpr, rx, ry, rw, rh);
          ctx.restore();
        }
      }

      // Batch dots into a few alpha levels: bucket once (counting sort), then
      // one path + fill per level.
      levelCount.fill(0);
      for (let i = 0; i < total; i += 1) {
        const a = alphaOut[i];
        if (a >= 0.015) levelCount[Math.min(ALPHA_LEVELS, Math.ceil(a * ALPHA_LEVELS))] += 1;
      }
      for (let level = 1, sum = 0; level <= ALPHA_LEVELS; level += 1) {
        const n = levelCount[level];
        levelCount[level] = sum;
        sum += n;
      }
      levelStart.set(levelCount);
      for (let i = 0; i < total; i += 1) {
        const a = alphaOut[i];
        if (a >= 0.015) order[levelCount[Math.min(ALPHA_LEVELS, Math.ceil(a * ALPHA_LEVELS))]++] = i;
      }
      for (let level = 1; level <= ALPHA_LEVELS; level += 1) {
        const end = levelCount[level];
        if (end === levelStart[level]) continue;
        ctx.globalAlpha = (level - 0.5) / ALPHA_LEVELS;
        ctx.fillStyle = palette[level] ?? color;
        ctx.beginPath();
        for (let k = levelStart[level]; k < end; k += 1) {
          const i = order[k];
          const r = radiusOut[i];
          ctx.moveTo(drawX[i] + r, drawY[i]);
          ctx.arc(drawX[i], drawY[i], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !visible) return;
      const elapsed = (now - start) / 1000;
      const morph = morphFrame(elapsed, toneFrames.length);
      const pointerMoving = Math.abs((pointerActive ? 1 : 0) - pointerLift) > 0.002
        || (pointerActive && (Math.abs(targetX - pointerX) > 0.1 || Math.abs(targetY - pointerY) > 0.1));
      const moving = morph.progress > 0 || pointerMoving || ripples.length > 0 || invertProgress(now) < 1;
      const due = dirty || moving || wasMoving || paintedImage !== morph.from;
      if (due && now - lastPaint >= MIN_FRAME_MS) {
        // Frame-rate independent easing toward the pointer.
        const k = Math.min(1, (now - lastPaint) / 16.7);
        lastPaint = now;
        pointerLift += ((pointerActive ? 1 : 0) - pointerLift) * Math.min(1, 0.12 * k);
        if (pointerX < -1e3) {
          pointerX = targetX;
          pointerY = targetY;
        } else {
          pointerX += (targetX - pointerX) * Math.min(1, 0.28 * k);
          pointerY += (targetY - pointerY) * Math.min(1, 0.28 * k);
        }
        paint(elapsed, true, now);
        dirty = false;
        paintedImage = morph.from;
        wasMoving = moving;
      }
      if (due) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (toneFrames.length < 2) return;
      // Held images only poll for their next morph; they do not repaint.
      wakeTimer = setTimeout(() => {
        wakeTimer = 0;
        if (!disposed && visible && !frame) frame = requestAnimationFrame(tick);
      }, 250);
    };

    const schedule = () => {
      if (disposed || !visible) return;
      dirty = true;
      if (wakeTimer) {
        clearTimeout(wakeTimer);
        wakeTimer = 0;
      }
      if (!canAnimate()) {
        cancelAnimationFrame(frame);
        frame = 0;
        paint(0, false);
        return;
      }
      if (!frame && visible) frame = requestAnimationFrame(tick);
    };

    const rebuild = () => {
      // Sample the portrait once its images settle; no interim globe build.
      if (!settled) return;
      readTheme();
      resize();
      ready = Boolean(field) && settled;
      if (field && canvas) {
        canvas.style.setProperty('--reveal-x', `${field.cx}px`);
        canvas.style.setProperty('--reveal-y', `${field.cy}px`);
      }
      schedule();
    };

    let resizeFrame = 0;
    const queueRebuild = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(rebuild);
    };

    // Settle independently (including a timeout), then retain YAML order.
    // Decode and pixel-read failures, including missing CORS, are omitted.
    void Promise.all(sources.map((source) => new Promise<{ image: HTMLImageElement; analysis: Analysis } | null>((resolve) => {
      const image = new Image();
      pendingImages.push(image);
      image.decoding = 'async';
      image.crossOrigin = 'anonymous';
      const finish = (result: { image: HTMLImageElement; analysis: Analysis } | null) => {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(result);
      };
      const timer = setTimeout(() => finish(null), 10000);
      loadTimers.push(timer);
      image.onload = async () => {
        if (disposed) { finish(null); return; }
        // Decode off the main thread first; otherwise the first drawImage below
        // decodes the full photo synchronously inside a long task.
        await image.decode().catch(() => undefined);
        if (disposed) { finish(null); return; }
        try {
          const crop = { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
          // Probe readability before including a remote image in the loop.
          const readable = readLuminance(image, crop, 1, 1);
          // Configured cut-out artwork keeps its own shape; opaque photos get
          // backdrop removal so they don't render as a light-backdrop negative.
          const analysis = images.length && hasTransparency(image)
            ? { backdrop: 0, crop, transparent: true }
            : analyse(image);
          finish(readable && analysis ? { image, analysis } : null);
        } catch {
          finish(null);
        }
      };
      image.onerror = () => finish(null);
      image.src = source;
    }))).then((results) => {
      if (disposed) return;
      loaded.push(...results.filter((result): result is NonNullable<typeof result> => result !== null));
      start = performance.now();
      settled = true;
      queueRebuild();
    });
    queueRebuild();

    const resizeObserver = new ResizeObserver(queueRebuild);
    resizeObserver.observe(host);
    if (slot) resizeObserver.observe(slot);

    // The theme switch transitions colours, so reading synchronously captures
    // the outgoing theme (Chrome reports the interpolated value). Re-read the
    // palette once the host's colour transitions have finished.
    let themeFrame = 0;
    let themeGeneration = 0;
    const themeObserver = new MutationObserver(() => {
      cancelAnimationFrame(themeFrame);
      const generation = ++themeGeneration;
      const syncPalette = () => {
        if (disposed || generation !== themeGeneration) return;
        readTheme();
        drawAmbientLayer();
        schedule();
      };
      themeFrame = requestAnimationFrame(() => {
        const transitions = host?.getAnimations() ?? [];
        if (!transitions.length) syncPalette();
        else void Promise.allSettled(transitions.map((animation) => animation.finished)).then(syncPalette);
      });
      const target = lightTheme();
      if (target !== inkTarget) {
        const now = performance.now();
        // Snapshot what is on screen so reversing mid-wave continues smoothly.
        const midWave = invertProgress(now) < 1 && blendFrames.length === toneFrames.length;
        invertFrom = midWave ? blendFrames.map((frame) => frame.slice()) : toneFrames;
        inkTarget = target;
        applyTarget();
        invertCells = toneFrames.map((to, k) => {
          const from = invertFrom[k];
          const cells: number[] = [];
          for (let i = 0; i < to.length; i += 1) if (to[i] > 0 || (from && from[i] > 0)) cells.push(i);
          return Int32Array.from(cells);
        });
        if (canAnimate() && field && toneFrames.length) {
          invertStart = now;
          // A ripple from the portrait carries the wavefront visually.
          ripples.push({ x: field.cx, y: field.cy, t: now });
          if (ripples.length > MAX_RIPPLES) ripples.shift();
        }
      }
      schedule();
    });
    // Only theme/accent changes matter; unrelated root class toggles must not
    // redraw the whole ambient grid.
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style']
    });

    const intersection = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      visible = inViewport && document.visibilityState === 'visible';
      if (visible) schedule();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = 0;
      }
    });
    intersection.observe(host);

    const onVisibility = () => {
      visible = inViewport && document.visibilityState === 'visible';
      if (visible) schedule();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Listen on the hero (host's parent) so the field reacts beneath the copy too.
    // Mouse/pen use pointer events; touch also listens to passive touch events,
    // because pointer events are cancelled as soon as the page starts scrolling.
    const pointerTarget = host.parentElement ?? host;
    const toLocal = (clientX: number, clientY: number) => {
      if (!host) return null;
      const rect = host.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const track = (clientX: number, clientY: number) => {
      if (!canAnimate()) return;
      const p = toLocal(clientX, clientY);
      if (!p) return;
      targetX = p.x;
      targetY = p.y;
      if (!pointerActive && pointerLift < 0.01) {
        pointerX = p.x;
        pointerY = p.y;
      }
      pointerActive = true;
      schedule();
    };
    const release = () => {
      pointerActive = false;
      schedule();
    };
    const addRipple = (clientX: number, clientY: number) => {
      if (!canAnimate()) return;
      const p = toLocal(clientX, clientY);
      if (!p) return;
      ripples.push({ x: p.x, y: p.y, t: performance.now() });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
      schedule();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      track(event.clientX, event.clientY);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      addRipple(event.clientX, event.clientY);
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      track(touch.clientX, touch.clientY);
      addRipple(touch.clientX, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) track(touch.clientX, touch.clientY);
    };
    pointerTarget.addEventListener('pointermove', onPointerMove, { passive: true });
    pointerTarget.addEventListener('pointerdown', onPointerDown, { passive: true });
    pointerTarget.addEventListener('pointerleave', release);
    pointerTarget.addEventListener('touchstart', onTouchStart, { passive: true });
    pointerTarget.addEventListener('touchmove', onTouchMove, { passive: true });
    pointerTarget.addEventListener('touchend', release, { passive: true });
    pointerTarget.addEventListener('touchcancel', release, { passive: true });

    reducedMotion.addEventListener('change', rebuild);
    lowPower.addEventListener('change', rebuild);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (wakeTimer) clearTimeout(wakeTimer);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(themeFrame);
      cancelExtraField();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', rebuild);
      lowPower.removeEventListener('change', rebuild);
      pointerTarget.removeEventListener('pointermove', onPointerMove);
      pointerTarget.removeEventListener('pointerdown', onPointerDown);
      pointerTarget.removeEventListener('pointerleave', release);
      pointerTarget.removeEventListener('touchstart', onTouchStart);
      pointerTarget.removeEventListener('touchmove', onTouchMove);
      pointerTarget.removeEventListener('touchend', release);
      pointerTarget.removeEventListener('touchcancel', release);
      for (const timer of loadTimers) clearTimeout(timer);
      for (const image of pendingImages) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
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
    /* sRGB-normalised so the canvas can parse the computed colours directly. */
    color: color-mix(in srgb, var(--dot-field-color, var(--accent)) 100%, transparent);
    outline-color: color-mix(in srgb, var(--dot-field-hot, var(--dot-field-color, var(--accent))) 100%, transparent);
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  canvas {
    display: block;
    opacity: 0;
  }

  /* One-shot entrance from the focal point; no per-frame JS. */
  .ready canvas {
    opacity: 1;
    animation: dot-field-reveal 1100ms var(--ease-smooth-out) both;
  }
  @keyframes dot-field-reveal {
    from { opacity: 0; clip-path: circle(0 at var(--reveal-x, 70%) var(--reveal-y, 50%)); }
    40% { opacity: 1; }
    to { opacity: 1; clip-path: circle(150% at var(--reveal-x, 70%) var(--reveal-y, 50%)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ready canvas { animation: none; }
  }
</style>
