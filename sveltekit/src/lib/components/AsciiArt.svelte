<script lang="ts">
  type ObjectFit = 'cover' | 'contain' | 'fill';

  interface Props {
    src: string;
    resolution?: number;
    charset?: 'dots' | string;
    color?: string;
    backgroundColor?: string;
    inverted?: boolean;
    colored?: boolean;
    objectFit?: ObjectFit;
    className?: string;
  }

  let {
    src,
    resolution = 80,
    charset = 'dots',
    color = 'var(--accent)',
    backgroundColor = 'transparent',
    inverted = false,
    colored = false,
    objectFit = 'cover',
    className = ''
  }: Props = $props();

  let host: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let ready = $state(false);

  const PRESETS: Record<string, string> = {
    dots: ' ·•●'
  };

  function resolveCssColor(value: string, element: HTMLElement): string {
    const match = value.match(/^var\((--[^,)]+)/);
    if (!match) return value;
    return getComputedStyle(element).getPropertyValue(match[1]).trim() || '#ffffff';
  }

  function fitRect(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    fit: ObjectFit
  ) {
    if (fit === 'fill') {
      return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;

    if ((fit === 'cover' && sourceRatio > targetRatio) || (fit === 'contain' && sourceRatio < targetRatio)) {
      const sw = sourceHeight * targetRatio;
      return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
    }

    const sh = sourceWidth / targetRatio;
    return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
  }

  function drawAscii(image: HTMLImageElement) {
    if (!host || !canvas || !image.naturalWidth || !image.naturalHeight) return;

    const bounds = host.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;

    const chars = PRESETS[charset] ?? charset;
    const columns = Math.max(28, Math.min(140, Math.round(resolution)));
    const cellWidth = bounds.width / columns;
    const fontSize = Math.max(5, cellWidth * 1.36);
    const cellHeight = fontSize * 1.02;
    const rows = Math.max(12, Math.round(bounds.height / cellHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    const resolvedBackground = resolveCssColor(backgroundColor, host);
    if (resolvedBackground !== 'transparent') {
      ctx.fillStyle = resolvedBackground;
      ctx.fillRect(0, 0, bounds.width, bounds.height);
    }

    const sample = document.createElement('canvas');
    sample.width = columns;
    sample.height = rows;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return;

    sampleCtx.clearRect(0, 0, columns, rows);
    const fit = fitRect(image.naturalWidth, image.naturalHeight, columns, rows, objectFit);

    if (objectFit === 'contain') {
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = columns / rows;
      let dw = columns;
      let dh = rows;
      let dx = 0;
      let dy = 0;
      if (sourceRatio > targetRatio) {
        dh = columns / sourceRatio;
        dy = (rows - dh) / 2;
      } else {
        dw = rows * sourceRatio;
        dx = (columns - dw) / 2;
      }
      sampleCtx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, dx, dy, dw, dh);
    } else {
      sampleCtx.drawImage(image, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, columns, rows);
    }

    const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
    const resolvedColor = resolveCssColor(color, host);
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const index = (y * columns + x) * 4;
        const alpha = pixels[index + 3] / 255;
        if (alpha < 0.08) continue;

        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        let luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        if (inverted) luminance = 1 - luminance;

        /* Preserve face structure better than a linear map: suppress deep shadows,
           then give mid/high tones more room across the dots charset. */
        const normalized = Math.max(0, Math.min(1, (luminance - 0.10) / 0.82));
        const charIndex = Math.max(0, Math.min(chars.length - 1, Math.round(normalized * (chars.length - 1))));
        const char = chars[charIndex];
        if (!char || char === ' ') continue;

        ctx.globalAlpha = Math.max(0.20, alpha * (0.40 + normalized * 0.60));
        ctx.fillStyle = colored ? `rgb(${red} ${green} ${blue})` : resolvedColor;
        ctx.fillText(char, (x + 0.5) * cellWidth, (y + 0.5) * cellHeight);
      }
    }

    ctx.globalAlpha = 1;
    ready = true;
  }

  $effect(() => {
    const source = src;
    if (!host || !canvas || !source) return;

    let disposed = false;
    let frame = 0;
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!disposed) drawAscii(image);
      });
    };

    image.onload = render;
    image.onerror = () => {
      ready = false;
    };
    image.src = source;

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    const themeObserver = new MutationObserver(render);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class']
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      image.onload = null;
      image.onerror = null;
    };
  });
</script>

<div
  bind:this={host}
  class="ascii-art {className}"
  class:ready
  role="img"
  aria-label="ASCII portrait generated from the profile image"
>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <span class="ascii-art-scan" aria-hidden="true"></span>
</div>

<style>
  .ascii-art {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0;
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 16%, transparent));
    transition:
      opacity 700ms cubic-bezier(0.16, 1, 0.3, 1),
      filter 220ms ease;
  }

  .ready canvas {
    opacity: 0.96;
  }

  .ascii-art-scan {
    position: absolute;
    inset: -24% -12%;
    background: linear-gradient(
      105deg,
      transparent 36%,
      color-mix(in srgb, var(--accent) 13%, white 7%) 49%,
      transparent 62%
    );
    mix-blend-mode: screen;
    transform: translateX(-62%) rotate(-8deg);
    animation: ascii-scan 7.5s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes ascii-scan {
    0%, 22% {
      transform: translateX(-68%) rotate(-8deg);
      opacity: 0;
    }
    34% {
      opacity: 0.72;
    }
    66% {
      opacity: 0.5;
    }
    78%, 100% {
      transform: translateX(68%) rotate(-8deg);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ascii-art-scan {
      animation: none;
      opacity: 0;
    }

    canvas {
      transition: none;
    }
  }
</style>
