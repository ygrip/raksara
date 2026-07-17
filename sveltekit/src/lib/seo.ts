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

type SiteSeoConfig = {
  site_name?: string;
  alternate_names?: string[];
  author_path?: string;
};

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

function getSiteSeoConfig(config: SiteConfig): SiteSeoConfig {
  const raw = config as SiteConfig & { seo?: SiteSeoConfig };
  return raw.seo ?? {};
}

/** Resolve brand/site name from config (SEO site name takes priority). */
function brandName(config: SiteConfig): string {
  const seo = getSiteSeoConfig(config);
  return seo.site_name ?? config.hero_title ?? config.title ?? '';
}

/** Build PageMeta for a blog post or portfolio item. */
export function buildPostMeta(
  post: Post | PortfolioItem,
  config: SiteConfig,
  slug: string
): PageMeta {
  const isPost = post.section === 'blog';
  const siteUrl = config.site_url ?? config.url;
  const root = (siteUrl ?? '').replace(/\/+$/, '');
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
        ...(root ? { '@id': `${root}/#author` } : {}),
        name: authorName,
      },
    ],
    datePublished: post.date,
    dateModified: updatedDate,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(root ? { isPartOf: { '@id': `${root}/#website` } } : {}),
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
  const url = resolveUrl(opts.path ?? '/', config.site_url ?? config.url);
  return {
    title,
    description,
    url,
    image: opts.image,
    type: 'website',
  };
}

/** Build WebSite JSON-LD schema for the homepage. */
export function buildWebSiteSchema(config: SiteConfig, siteUrl: string): JsonLdObject {
  const root = siteUrl.replace(/\/+$/, '');
  const seo = getSiteSeoConfig(config);
  const name = seo.site_name ?? config.hero_title ?? config.title ?? '';
  const alternateNames = Array.isArray(seo.alternate_names)
    ? Array.from(new Set(seo.alternate_names.map((value) => String(value).trim()).filter((value) => value && value !== name)))
    : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${root}/#website`,
    name,
    ...(alternateNames.length === 1 ? { alternateName: alternateNames[0] } : {}),
    ...(alternateNames.length > 1 ? { alternateName: alternateNames } : {}),
    ...(config.description || config.hero_subtitle
      ? { description: config.description ?? config.hero_subtitle }
      : {}),
    url: `${root}/`,
    ...(config.author ? { creator: { '@id': `${root}/#author` } } : {}),
  };
}

/** Build Person JSON-LD schema for the site author. Returns null if no author configured. */
export function buildPersonSchema(config: SiteConfig, siteUrl: string): JsonLdObject | null {
  const author = config.author;
  if (!author) return null;
  const root = siteUrl.replace(/\/+$/, '');
  const seo = getSiteSeoConfig(config);
  const authorPath = String(seo.author_path ?? '/profile/').trim() || '/profile/';
  const sameAs: string[] = [];
  if (config.social) {
    for (const val of Object.values(config.social)) {
      if (typeof val === 'string' && /^https?:\/\//i.test(val)) sameAs.push(val);
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${root}/#author`,
    name: author,
    url: resolveUrl(authorPath, root),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Build BreadcrumbList JSON-LD schema. Items ordered from root to current page. */
export function buildBreadcrumbSchema(
  items: Array<{ name: string; url?: string }>,
  siteUrl: string
): JsonLdObject {
  const root = siteUrl.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url
        ? { item: `${root}${item.url.startsWith('/') ? item.url : '/' + item.url}` }
        : {}),
    })),
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
