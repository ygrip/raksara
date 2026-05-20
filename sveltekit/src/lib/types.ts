// src/lib/types.ts
// Canonical TypeScript types derived from Raksara metadata JSON shapes.
// Keep in sync with scripts/schemas.js.

export interface Post {
  title: string;
  slug: string;
  path: string;
  section: 'blog';
  date: string;
  tags?: string[];
  category?: string;
  summary?: string;
  cover?: string;
  dir?: string;
  series?: string;
  chapter?: string | number;
  order?: number;
  type?: 'poem' | 'novel' | 'chapters' | 'comic' | string;
  author?: string;
  readingMode?: boolean;
  comments_enabled?: boolean;
  status?: 'draft' | 'ongoing' | 'completed';
  ogImage?: { landscape: string; portrait: string };
}

export interface PortfolioItem {
  title: string;
  slug: string;
  path: string;
  section: 'portfolio';
  date: string;
  tags?: string[];
  category?: string;
  summary?: string;
  cover?: string;
  github?: string;
  demo?: string;
  status?: 'draft' | 'ongoing' | 'completed';
  ogImage?: { landscape: string; portrait: string };
}

export interface GalleryImage {
  src: string;
  alt?: string;
  caption?: string;
}

export interface GalleryItem {
  title: string;
  slug: string;
  path: string;
  section: 'gallery';
  date: string;
  image?: string;
  images?: GalleryImage[];
  caption?: string;
  description?: string;
  tags?: string[];
  category?: string;
  ogImage?: { landscape: string; portrait: string };
}

export interface Thought {
  title: string;
  slug: string;
  path: string;
  section: 'thoughts';
  date: string;
  body?: string;
  tags?: string[];
  ogImage?: { landscape: string; portrait: string };
}

export interface Page {
  title: string;
  slug: string;
  path: string;
  section: 'pages';
  date?: string;
  summary?: string;
  cover?: string;
  avatar?: string;
  role?: string;
  location?: string;
  github?: string;
  linkedin?: string;
  medium?: string;
  email?: string;
  metadata?: Array<string | { label?: string; value?: string; url?: string }>;
  ogImage?: { landscape: string; portrait: string };
}

export interface DocEntry {
  title: string;
  slug: string;
  path: string;
  section: string;
  summary?: string;
  description?: string;
  icon?: string;
  status?: string;
}

export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
}

export interface CommentsConfig extends GiscusConfig {
  enabled: boolean;
  /** Which section routes show comments by default: 'blog' | 'portfolio' etc. */
  pages?: string[];
}

export interface SiteConfig {
  title: string;
  description?: string;
  url?: string;
  site_url?: string;
  author?: string;
  accent?: string;
  /** Gradient stop 1 (CSS colour) */
  gradient_1?: string;
  /** Gradient stop 2 */
  gradient_2?: string;
  /** Gradient stop 3 */
  gradient_3?: string;
  logo?: string;
  favicon?: string;
  /** Google Font family name, e.g. "Inter" */
  font?: string;
  hero_title?: string;
  hero_subtitle?: string;
  nav?: Array<{ label: string; href: string }>;
  /** AdSense publisher ID string or structured object from config.json */
  adsense?: string | Record<string, string>;
  /** Giscus top-level (legacy / direct) */
  giscus?: GiscusConfig;
  /** Preferred: nested comments block with enabled flag and page list */
  comments?: CommentsConfig;
  social?: Record<string, string>;
  /** Color theme keyword (purple | blue | green …) used as fallback accent */
  color?: string;
}

export interface BlogDirEntry {
  subdirs: string[];
  posts: Post[];
}

export type BlogDirs = Record<string, BlogDirEntry>;

export interface ImageVariant {
  width: number;
  path: string;
}

export interface ImageManifestEntry {
  width: number;
  height: number;
  lqip?: string;
  variants: ImageVariant[];
}

export type ImageManifest = Record<string, ImageManifestEntry>;

export interface HomeBundle {
  posts: Post[];
  thoughts: Thought[];
  portfolio: PortfolioItem[];
  gallery: GalleryItem[];
  config: SiteConfig;
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  section: string;
  category?: string;
  score: number;
  terms: string[];
}

export interface DocPage extends Page {
  icon?: string;
  status?: string;
  next_page?: Array<{ title: string; link: string }> | { title: string; link: string };
  previous_page?: Array<{ title: string; link: string }> | { title: string; link: string };
}
