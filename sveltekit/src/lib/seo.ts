/**
 * Raksara SEO helpers for SvelteKit.
 * Generates JSON-LD structured data and social meta tag objects.
 */

import type { SiteConfig, Post, PortfolioItem } from './types';

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article';
  author?: string;
  date?: string;
  tags?: string[];
  jsonLd?: string;
}

function resolveUrl(path: string, siteUrl?: string): string {
  const base = (siteUrl ?? '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

/** Build PageMeta for a blog post or portfolio item. */
export function buildPostMeta(
  post: Post | PortfolioItem,
  config: SiteConfig,
  slug: string
): PageMeta {
  const isPost = post.section === 'blog';
  const url = resolveUrl(isPost ? `/blog/post/${slug}` : `/portfolio/${slug}`, config.url);
  const image = post.cover ? resolveUrl(post.cover, config.url) : undefined;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': isPost ? 'Article' : 'SoftwareApplication',
    headline: post.title,
    description: post.summary ?? '',
    author: { '@type': 'Person', name: (post as Post & { author?: string }).author ?? config.author ?? '' },
    datePublished: post.date,
    url,
    ...(image ? { image } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  });

  return {
    title: `${post.title} — ${config.title}`,
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
  const title = opts.title ? `${opts.title} — ${config.title}` : config.title;
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
