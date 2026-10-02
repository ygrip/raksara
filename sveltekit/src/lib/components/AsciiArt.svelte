<script lang="ts">
  type ObjectFit = 'cover' | 'contain' | 'fill';

  interface Props {
    src: string;
    resolution?: number;
    charset?: 'dots' | 'braille' | string;
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
    charset = 'braille',
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

  const BRAILLE_DOTS = [
    { dx: 0, dy: 0, bit: 0 }, // dot 1
    { dx: 0, dy: 1, bit: 1 }, // dot 2
    { dx: 0, dy: 2, bit: 2 }, // dot 3
    { dx: 1, dy: 0, bit: 3 }, // dot 4
    { dx: 1, dy: 1, bit: 4 }, // dot 5
    { dx: 1, dy: 2, bit: 5 }, // dot 6
    { dx: 0, dy: 3, bit: 6 }, // dot 7
    { dx: 1, dy: 3, bit: 7 }  // dot 8
  ];

  /* Ordered thresholds turn luminance into density without a second animation
     or noise pass. The result stays portrait-like while remaining genuinely
     Unicode Braille instead of ordinary dot glyphs in a trench coat. */
  const BRAILLE_THRESHOLDS = [
    [0.16, 0.58],
    [0.68, 0.30],
    [0.42, 0.78],
    [0.86, 0.24]
  ];

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

    const braille = charset === 'braille';
    const columns = braille
      ? Math.max(34, Math.min(120, Math.round(resolution)))
      : Math.max(28, Math.min(140, Math.round(resolution)));

    const cellWidth = bounds.width / columns;
    const fontSize = braille
      ? Math.max(7, cellWidth * 1.76)
      : Math.max(5, cellWidth * 1.36);
    const cellHeight = fontSize * (braille ? 0.98 : 1.02);
    const rows = Math.max(12, Math.round(bounds.height / cellHeight));
    const sampleWidth = braille ? columns * 2 : columns;
    const sampleHeight = braille ? rows * 4 : rows;
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
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return;

    sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
    const fit = fitRect(
      image.naturalWidth,
      image.naturalHeight,
      sampleWidth,
      sampleHeight,
      objectFit
    );

    if (objectFit === 'contain') {
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = sampleWidth / sampleHeight;
      let dw = sampleWidth;
      let dh = sampleHeight;
      let dx = 0;
      let dy = 0;

      if (sourceRatio > targetRatio) {
        dh = sampleWidth / sourceRatio;
        dy = (sampleHeight - dh) / 2;
      } else {
        dw = sampleHeight * sourceRatio;
        dx = (sampleWidth - dw) / 2;
      }

      sampleCtx.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        dx,
        dy,
        dw,
        dh
      );
    } else {
      sampleCtx.drawImage(
        image,
        fit.sx,
        fit.sy,
        fit.sw,
        fit.sh,
        0,
        0,
        sampleWidth,
        sampleHeight
      );
    }

    const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const resolvedColor = resolveCssColor(color, host);
    ctx.font = `${braille ? 500 : 600} ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = resolvedColor;

    const luminanceAt = (x: number, y: number) => {
      const index = (y * sampleWidth + x) * 4;
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.08) {
        return { alpha: 0, normalized: 0, red: 0, green: 0, blue: 0 };
      }

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      let luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      if (inverted) luminance = 1 - luminance;

      return {
        alpha,
        normalized: Math.max(0, Math.min(1, (luminance - 0.08) / 0.84)),
        red,
        green,
        blue
      };
    };

    if (braille) {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          let mask = 0;
          let alphaTotal = 0;
          let activeDots = 0;
          let redTotal = 0;
          let greenTotal = 0;
          let blueTotal = 0;

          for (const dot of BRAILLE_DOTS) {
            const x = column * 2 + dot.dx;
            const y = row * 4 + dot.dy;
            const pixel = luminanceAt(x, y);
            if (pixel.alpha <= 0) continue;

            const threshold = BRAILLE_THRESHOLDS[dot.dy][dot.dx];
            if (pixel.normalized >= threshold) {
              mask |= 1 << dot.bit;
              alphaTotal += pixel.alpha;
              redTotal += pixel.red;
              greenTotal += pixel.green;
              blueTotal += pixel.blue;
              activeDots += 1;
            }
          }

          if (mask === 0 || activeDots === 0) continue;

          const char = String.fromCharCode(0x2800 + mask);
          ctx.globalAlpha = Math.min(0.76, 0.26 + (alphaTotal / activeDots) * 0.46);
          ctx.fillStyle = colored
            ? `rgb(${Math.round(redTotal / activeDots)} ${Math.round(greenTotal / activeDots)} ${Math.round(blueTotal / activeDots)})`
            : resolvedColor;
          ctx.fillText(
            char,
            (column + 0.5) * cellWidth,
            (row + 0.5) * cellHeight
          );
        }
      }
    } else {
      const chars = PRESETS[charset] ?? charset;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const pixel = luminanceAt(x, y);
          if (pixel.alpha <= 0) continue;

          const charIndex = Math.max(
            0,
            Math.min(chars.length - 1, Math.round(pixel.normalized * (chars.length - 1)))
          );
          const char = chars[charIndex];
          if (!char || char === ' ') continue;

          ctx.globalAlpha = Math.max(
            0.18,
            pixel.alpha * (0.34 + pixel.normalized * 0.48)
          );
          ctx.fillStyle = colored
            ? `rgb(${pixel.red} ${pixel.green} ${pixel.blue})`
            : resolvedColor;
          ctx.fillText(
            char,
            (x + 0.5) * cellWidth,
            (y + 0.5) * cellHeight
          );
        }
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
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 8%, transparent));
  }

  .ready canvas {
    opacity: 0.78;
  }
</style>
