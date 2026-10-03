import { assetUrl } from './utils';

/** Only browser image formats; reject malformed YAML entries and unsafe schemes. */
export function dotFieldImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    const source = entry.trim();
    if (!source || /^(?!https?:)[a-z][a-z\d+.-]*:/i.test(source)) return [];
    if (!/\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(source)) return [];
    return [assetUrl(source.replace(/^(?:\.\/)+/, ''))];
  }))];
}

/** Map a grid sample using a separate full, in-bounds probe for alpha/background.
 * Transparent black artwork needs an ink floor; opaque white backgrounds don't. */
export function imageTonePixels(pixels: Uint8ClampedArray, fullPixels: Uint8ClampedArray, probeCols: number): Float32Array {
  const tones = new Float32Array(pixels.length / 4);
  const probeSize = fullPixels.length / 4;
  let transparent = false;
  let border = 0;
  let borderCount = 0;
  const luminance = (data: Uint8ClampedArray, p: number) =>
    (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
  for (let i = 0; i < probeSize; i++) {
    const p = i * 4;
    if (fullPixels[p + 3] < 250) transparent = true;
    const x = i % probeCols;
    if (x === 0 || x === probeCols - 1 || i < probeCols || i >= probeSize - probeCols) {
      border += luminance(fullPixels, p);
      borderCount++;
    }
  }
  const invert = border / borderCount > 0.65;
  for (let i = 0; i < tones.length; i++) {
    const p = i * 4;
    const lum = luminance(pixels, p);
    const ink = invert ? 1 - lum : lum;
    tones[i] = (pixels[p + 3] / 255) * (transparent ? 0.65 + 0.35 * ink : ink);
  }
  return tones;
}

/** Hold each image for 4s, then travel to the next for 2.4s, including last → first.
 * `progress` is linear 0..1 through the transition and 0 while holding `from`. */
export function morphFrame(elapsed: number, count: number) {
  if (count < 2) return { from: 0, to: 0, progress: 0 };
  const cycle = 6.4;
  const time = Math.max(0, elapsed);
  const step = Math.floor(time / cycle);
  return { from: step % count, to: (step + 1) % count, progress: Math.max(0, (time % cycle - 4) / 2.4) };
}

/** Distance along a Hilbert curve over an `order`×`order` grid (order = power of two). */
export function hilbertIndex(order: number, x: number, y: number): number {
  let d = 0;
  for (let s = order >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = order - 1 - x;
        y = order - 1 - y;
      }
      const swap = x;
      x = y;
      y = swap;
    }
  }
  return d;
}

/**
 * Pair lit cells of two row-major tone grids into travelling particles. Both
 * sets are ordered along a Hilbert curve and matched proportionally, so
 * neighbouring dots stay neighbours in flight and every lit cell of either
 * image is covered (the smaller set fans out / merges).
 */
export function morphPairs(from: Float32Array, to: Float32Array, cols: number) {
  const rows = Math.ceil(from.length / cols);
  let order = 1;
  while (order < Math.max(cols, rows)) order <<= 1;
  const key = new Int32Array(from.length);
  const ordered = (tone: Float32Array) => {
    const cells: number[] = [];
    for (let i = 0; i < tone.length; i += 1) {
      if (tone[i] <= 0) continue;
      key[i] = hilbertIndex(order, i % cols, Math.floor(i / cols));
      cells.push(i);
    }
    return cells.sort((p, q) => key[p] - key[q]);
  };
  const a = ordered(from);
  const b = ordered(to);
  const count = Math.max(a.length, b.length);
  const src = new Int32Array(count);
  const dst = new Int32Array(count);
  for (let k = 0; k < count; k += 1) {
    dst[k] = b.length ? b[Math.floor((k * b.length) / count)] : a[k];
    src[k] = a.length ? a[Math.floor((k * a.length) / count)] : dst[k];
  }
  return { src, dst };
}

/** Shaded sphere with curved latitude/longitude lines: no image/network required. */
export function globeTone(x: number, y: number): number {
  const distance = x * x + y * y;
  if (distance >= 1) return 0;
  const z = Math.sqrt(1 - distance);
  const latitude = Math.asin(y);
  const longitude = Math.atan2(x, z);
  const mesh = Math.pow(Math.abs(Math.cos(latitude * 12)), 18)
    + Math.pow(Math.abs(Math.cos(longitude * 12)), 18);
  return Math.min(1, (0.18 + 0.36 * z + 0.42 * mesh) * Math.min(1, (1 - distance) * 16));
}
