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
  fetchpriority?: 'high' | 'low' | 'auto';
  /** BL-023: LQIP base64 data URI for blur-up placeholder */
  'data-lqip'?: string;
}

export function buildResponsiveAttrs(
  imagePath: string,
  manifest: ImageManifest | null,
  options: { eager?: boolean; sizes?: string } = {}
): ResponsiveAttrs {
  const sizes = options.sizes ?? '(max-width: 832px) calc(100vw - 32px), 800px';
  const attrs: ResponsiveAttrs = {
    src: `/${imagePath}`,
    loading: options.eager ? 'eager' : 'lazy',
  };
  if (options.eager) attrs.fetchpriority = 'high';

  const entry = manifest?.[imagePath];
  if (!entry?.variants?.length) return attrs;

  attrs.srcset = entry.variants.map((v) => `/${v.path} ${v.width}w`).join(', ');
  attrs.sizes = sizes;
  attrs.width = entry.width;
  attrs.height = entry.height;
  if (entry.lqip) attrs['data-lqip'] = entry.lqip;
  return attrs;
}
