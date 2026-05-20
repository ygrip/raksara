// src/lib/responsive-image.ts
// Builds responsive image attrs from the generated image manifest.
// Reads the image manifest to generate srcset + sizes attributes.

import type { ImageManifest } from './types';

export interface ResponsiveAttrs {
  src: string;
  srcset?: string;
  sizes?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
  fetchpriority?: 'high' | 'low' | 'auto';
  /** BL-023: LQIP base64 data URI for blur-up placeholder */
  'data-lqip'?: string;
}

// __BUILD_TS__ is injected by Vite at build time. Used to cache-bust asset URLs.
declare const __BUILD_TS__: string;
const _assetV = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';

/** Append ?v=<build> to a local URL. Skips external, data, and blob URLs. */
function withVersion(url: string): string {
  if (!url || !_assetV) return url;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${url}?v=${_assetV}`;
}

function normalizeImagePath(raw: string): string {
  let path = String(raw ?? '').trim();
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  path = path.replace(/^\/+/, '');
  // Strip query params / hash before manifest lookup so pre-versioned paths
  // (e.g. from assetUrl) still resolve correctly against the manifest keys.
  path = path.replace(/[?#].*$/, '');
  path = path.replace(/^content\/content\//, 'content/');
  if (!path.startsWith('content/') && /^(assets|blog|gallery|pages|portfolio|thoughts)\//.test(path)) {
    path = `content/${path}`;
  }
  return path;
}

function publicPath(path: string): string {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return `/${path.replace(/^\/+/, '')}`;
}

export function buildResponsiveAttrs(
  imagePath: string,
  manifest: ImageManifest | null,
  options: { eager?: boolean; sizes?: string; maxWidth?: number; includeOriginal?: boolean } = {}
): ResponsiveAttrs {
  const normalizedPath = normalizeImagePath(imagePath);
  const sizes = options.sizes ?? '(max-width: 832px) calc(100vw - 32px), 800px';
  const attrs: ResponsiveAttrs = {
    src: withVersion(publicPath(normalizedPath)),
    loading: options.eager ? 'eager' : 'lazy',
    decoding: 'async',
  };
  if (options.eager) attrs.fetchpriority = 'high';

  if (/^(https?:)?\/\//i.test(normalizedPath) || normalizedPath.startsWith('data:') || normalizedPath.startsWith('blob:')) {
    return attrs;
  }

  const entry = manifest?.[normalizedPath];
  if (!entry?.variants?.length) return attrs;

  const allVariants = [...entry.variants].sort((a, b) => a.width - b.width);
  const maxWidth = options.maxWidth;
  const variants = maxWidth
    ? allVariants.filter((variant) => variant.width <= maxWidth)
    : allVariants;
  const usableVariants = variants.length ? variants : allVariants.slice(0, 1);
  const includeOriginal = options.includeOriginal ?? !options.maxWidth;
  attrs.src = withVersion(publicPath(usableVariants[0]?.path ?? normalizedPath));
  attrs.srcset = [
    ...usableVariants.map((v) => `${withVersion(publicPath(v.path))} ${v.width}w`),
    ...(includeOriginal ? [`${withVersion(publicPath(normalizedPath))} ${entry.width}w`] : []),
  ].join(', ');
  attrs.sizes = sizes;
  attrs.width = entry.width;
  attrs.height = entry.height;
  if (entry.lqip) attrs['data-lqip'] = entry.lqip;
  return attrs;
}

export function responsiveAttrsToString(attrs: ResponsiveAttrs): string {
  return Object.entries(attrs)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${key}="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ');
}

export function buildLqipStyle(imagePath: string, manifest: ImageManifest | null): string | undefined {
  const normalizedPath = normalizeImagePath(imagePath);
  const lqip = manifest?.[normalizedPath]?.lqip;
  if (!lqip) return undefined;
  return `--lqip-url: url("${lqip.replace(/"/g, '%22')}")`;
}
