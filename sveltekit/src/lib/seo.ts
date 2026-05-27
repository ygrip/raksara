/**
 * Raksara SEO helpers for SvelteKit.
 * Generates JSON-LD structured data and social meta tag objects.
 */

import type { SiteConfig, Post, PortfolioItem } from './types';

export type JsonLdObject = Record<string, unknown>;

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article';
  author?: string;
  date?: string;
  tags?: string[];
  jsonLd?: JsonLdObject;
}

/** Serialize JSON-LD safely for injection into <script type="application/ld+json"> */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function resolveUrl(path: string, siteUrl?: string): string {
  const base = (siteUrl ?? '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

/** Resolve brand/site name from config (hero_title takes priority over title). */
function brandName(config: SiteConfig): string {
  return config.hero_title ?? config.title ?? 'Raksara';
}

/** Build PageMeta for a blog post or portfolio item. */
export function buildPostMeta(
  post: Post | PortfolioItem,
  config: SiteConfig,
  slug: string
): PageMeta {
  const isPost = post.section === 'blog';
  const siteUrl = config.site_url ?? config.url;
  const url = resolveUrl(isPost ? `/blog/post/${slug}` : `/portfolio/${slug}`, siteUrl);
  const image = post.cover ? resolveUrl(post.cover, siteUrl) : undefined;

  const authorName = (post as Post & { author?: string }).author ?? config.author ?? '';
  const updatedDate = (post as Post & { updated?: string; modified?: string }).updated
    ?? (post as Post & { updated?: string; modified?: string }).modified
    ?? post.date;

  const jsonLd: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': isPost ? 'BlogPosting' : 'SoftwareApplication',
    headline: post.title,
    description: post.summary ?? '',
    author: [
      {
        '@type': 'Person',
        name: authorName,
      },
    ],
    datePublished: post.date,
    dateModified: updatedDate,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    url,
    ...(image ? { image: [image] } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  };

  return {
    title: `${post.title} — ${brandName(config)}`,
    description: post.summary ?? config.description ?? '',
    url,
    image,
    type: 'article',
    author: config.author,
    date: post.date,
    tags: post.tags,
    jsonLd,
  };
}

/** Build PageMeta for a generic / index page. */
export function buildPageMeta(
  opts: {
    title?: string;
    description?: string;
    path?: string;
    image?: string;
  },
  config: SiteConfig
): PageMeta {
  const brand = brandName(config);
  const title = opts.title ? `${opts.title} — ${brand}` : brand;
  const description = opts.description ?? config.description ?? '';
  const url = resolveUrl(opts.path ?? '/', config.url);
  return {
    title,
    description,
    url,
    image: opts.image,
    type: 'website',
  };
}

/** Extract AdSense publisher ID from various config.adsense shapes. */
export function getAdsenseId(config: SiteConfig): string {
  const raw = config.adsense;
  if (!raw) return '';
  let candidate = '';
  if (typeof raw === 'string') {
    candidate = raw;
  } else if (typeof raw === 'object') {
    candidate = String(
      raw['publisher_id'] ?? raw['publisher'] ?? raw['pub'] ?? raw['account'] ?? ''
    );
  }
  const match = candidate.match(/pub-\d{6,}/i);
  if (!match) return '';
  const id = match[0].toLowerCase();
  // Ignore placeholder all-zeros pub IDs
  if (/^pub-0+$/.test(id)) return '';
  return id;
}

/** Resolve effective Giscus config from either config.comments or config.giscus. */
export function getGiscusConfig(config: SiteConfig): {
  enabled: boolean;
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  pages: string[];
} | null {
  const comments = config.comments;
  const giscus = config.giscus;
  if (comments?.enabled && comments.repo) {
    const raw = comments as typeof comments & { repo_id?: string; category_id?: string };
    return {
      enabled: true,
      repo: comments.repo,
      repoId: comments.repoId ?? raw.repo_id ?? '',
      category: comments.category,
      categoryId: comments.categoryId ?? raw.category_id ?? '',
      pages: comments.pages ?? ['blog', 'portfolio'],
    };
  }
  if (giscus?.repo) {
    const raw = giscus as typeof giscus & { repo_id?: string; category_id?: string };
    return {
      enabled: true,
      repo: giscus.repo,
      repoId: giscus.repoId ?? raw.repo_id ?? '',
      category: giscus.category,
      categoryId: giscus.categoryId ?? raw.category_id ?? '',
      pages: ['blog', 'portfolio'],
    };
  }
  return null;
}

/** Whether to show Giscus on a given page type, respecting frontmatter override. */
export function shouldShowGiscus(
  config: SiteConfig,
  pageType: string,
  commentsEnabled?: boolean
): boolean {
  const gcfg = getGiscusConfig(config);
  if (!gcfg) return false;
  if (commentsEnabled === false) return false;
  if (commentsEnabled === true) return true;
  return gcfg.pages.includes(pageType);
}
