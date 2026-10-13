# Readynaz SEO Audit & Optimization Plan

**Site audited:** <https://readynaz.com>  
**Audit date:** 2026-05-30  
**Scope:** Homepage, blog listing, sample blog posts, profile page, about page, search-result snippets, crawl/renderability risks, metadata strategy, structured data, internal linking, and implementation roadmap for a SvelteKit/Raksara-style static content platform.

---

## 1. Executive Summary

Readynaz already has a solid foundation: a clean information architecture, public routes for profile/blog/portfolio/gallery/thoughts/tags/categories/about, recent posts visible on the homepage, and a strong niche around engineering, automation, QA, Raksara, Testara, and personal writing.

The highest-priority SEO gap is **renderability/indexability of article and markdown content**. Several article pages expose their shell, title, date, tags, image alt text, and footer, but the article body appears as `Loading…` in the crawled text. This is a critical issue because the most valuable page content may not be present in the initial HTML payload.

The second major issue is **branding/title inconsistency**. Search-visible snippets show a mix of `Readynaz`, `Raksara`, `Profile - Raksara`, and `About Readynaz - Raksara`. Since Readynaz is the public site and Raksara is the engine/platform, the title and metadata strategy should make the distinction explicit.

The third major issue is **weak page-level semantic targeting**. The homepage appears to have a blank heading marker before the hero copy, and many page titles/descriptions are generic. This reduces clarity for search engines and users.

Recommended priority:

1. Fix SSR/static prerendering so blog and about content are present in initial HTML.
2. Standardize title/meta/canonical/Open Graph/Twitter metadata per route.
3. Add JSON-LD structured data for `WebSite`, `Person`, `BlogPosting`, and `BreadcrumbList`.
4. Generate and submit a complete sitemap; verify robots.txt.
5. Improve internal linking, author identity, topical clusters, and content templates.
6. Validate with Google Search Console, Rich Results Test, URL Inspection, and crawl tools.

---

## 2. Evidence from Live Crawl

### 2.1 Homepage

Observed crawlable content:

- Navigation links: Home, Profile, Blog, Portfolio, Gallery, Thoughts, Tags, Categories, About.
- Hero copy: `Read today, Ready tomorrow. Welcome to my personal blog...`
- Recent posts section is visible.
- Projects section is visible.
- Shower Thoughts section is visible.

SEO observations:

- The homepage has a visible heading marker followed by no text in the extracted crawl text. This suggests a possible empty `<h1>` or heading-rendering issue.
- The homepage title/snippet shown by search tooling is not fully aligned: `Raksara` appears as the title in search result output, while the site brand is Readynaz.
- The homepage has good internal links to blog posts, projects, gallery, and thoughts.

### 2.2 Blog Listing

Observed crawlable content:

- `/blog/` shows `# Blog`.
- It lists 10 posts.
- It exposes post titles, descriptions, dates, tags, and categories.
- Sorting controls are visible: latest, oldest, A-Z, Z-A.

SEO observations:

- The blog list is indexable and useful.
- Post metadata is crawlable at listing level.
- It can be improved with `ItemList` structured data and better pagination/indexing strategy if the number of posts grows.

### 2.3 Blog Post Pages

Sample pages checked:

- `/blog/post/stay-productive-with-github/`
- `/blog/post/extroverted-introvert-where-comfort-meets-change/`

Observed crawlable content:

- Breadcrumb context is visible.
- Article title is visible.
- Date and tags are visible.
- Image alt text is visible.
- Main body content appears as `Loading…`.

SEO observations:

- This is the most important problem. If the article body is loaded client-side after hydration, Google may still render it eventually, but indexing becomes less reliable and slower. Other crawlers, link preview bots, and SEO tools may only see the loading state.
- The article template should ensure the full markdown-rendered content is included in the server-rendered/static HTML.

### 2.4 Profile Page

Observed crawlable content:

- Full name: Yunaz Gilang Ramadhan.
- Role: Software Quality Assurance.
- Location: Indonesia.
- Focus: Test Automation & QA.
- Stack: Java, Spring, REST API, Selenium.
- About and skill sections are crawlable.

SEO observations:

- Good personal-brand foundation.
- Should add `ProfilePage` and/or `Person` structured data.
- Should include sameAs links for GitHub, LinkedIn, Medium, and email contact route where appropriate.
- Title currently appears inconsistent in search output: `Profile - Raksara`; should be closer to `Yunaz Gilang Ramadhan | Software Quality Assurance | Readynaz`.

### 2.5 About Page

Observed crawlable content:

- The page shows `Loading…` before documentation content.
- It contains documentation copy about Raksara components.

SEO observations:

- If the intended About page is about Readynaz, the visible content is currently skewed toward Raksara documentation.
- If this is a Raksara-powered site, separate pages are recommended:
  - `/about/` = about Readynaz/Yunaz/site purpose.
  - `/docs/` or `/raksara/docs/` = Raksara component documentation.

---

## 3. Priority Findings

| Priority | Finding | Impact | Recommended Fix |
|---|---|---:|---|
| P0 | Blog post bodies render as `Loading…` in crawled text | Very High | SSR or statically prerender markdown content into initial HTML. Do not rely on client-side fetch for article body. |
| P0 | Metadata/title branding is inconsistent between Readynaz and Raksara | High | Standardize title templates per route and clarify Raksara as platform attribution, not primary page brand. |
| P1 | Homepage appears to have an empty heading marker | High | Ensure exactly one meaningful `<h1>` on homepage, e.g. `Readynaz — Engineering, Automation, and Personal Writing`. |
| P1 | Missing or incomplete structured data | High | Add JSON-LD for `WebSite`, `Person`, `BlogPosting`, `BreadcrumbList`, and optionally `ItemList`. |
| P1 | Sitemap/robots not confirmed during audit | Medium/High | Generate `/sitemap.xml`, expose `/robots.txt`, submit sitemap to Search Console. |
| P1 | Generic page descriptions | Medium | Generate unique meta descriptions from frontmatter/excerpts. |
| P2 | About page content is semantically mixed with Raksara docs | Medium | Split site-about and Raksara-documentation intent into separate URLs. |
| P2 | Tags/categories may create thin duplicate indexable pages | Medium | Define index/noindex policy based on content depth. |
| P2 | Image SEO can be strengthened | Medium | Add width/height, descriptive alt text, optimized social preview images, and priority loading for LCP images. |
| P2 | Internal linking can better support topical authority | Medium | Create content clusters around QA automation, Raksara, Testara, SvelteKit, GitHub-native CMS, and automation observability. |

---

## 4. Implementation Plan

## Phase 1 — Fix Indexability and Rendering

### 4.1 Ensure article body is server-rendered or statically prerendered

Target outcome: every public article URL must contain the full article body in the initial HTML response.

Recommended SvelteKit approach:

- Use `+page.server.ts` or prerendered `load` data for content resolution.
- Avoid fetching markdown content only from browser-side `onMount`.
- If content comes from GitHub/content repository, resolve it during build or server load.
- If using GitHub Pages static hosting, generate static HTML at build time.
- Keep client-side enhancement for search/filter/sorting only, not primary article content.

Acceptance criteria:

- `view-source:https://readynaz.com/blog/post/<slug>/` contains article body text.
- `curl -L https://readynaz.com/blog/post/<slug>/` contains article body text.
- Google Search Console URL Inspection rendered HTML shows article body.
- No public content page renders `Loading…` as the only body content.

### 4.2 Replace loading-only markdown hydration pattern

Current risky pattern:

```svelte
<script>
  import { onMount } from 'svelte';
  let content = 'Loading…';
  onMount(async () => {
    content = await fetchPostContent();
  });
</script>

<article>{@html content}</article>
```

Preferred pattern:

```ts
// +page.server.ts or prerender-compatible load source
export async function load({ params }) {
  const post = await getPostBySlug(params.slug);

  return {
    post,
    html: post.renderedHtml,
    seo: post.seo
  };
}
```

```svelte
<script lang="ts">
  export let data;
</script>

<article class="prose">
  {@html data.html}
</article>
```

For static GitHub Pages deployment, make sure the content is available at build time and `prerender = true` is applied where appropriate.

---

## Phase 2 — Metadata and Canonical Strategy

### 4.3 Standardize title templates

Recommended title rules:

| Route Type | Template |
|---|---|
| Homepage | `Readynaz — Engineering, Automation, QA, and Personal Writing` |
| Blog index | `Blog | Readynaz` |
| Blog post | `{post.title} | Readynaz` |
| Profile | `Yunaz Gilang Ramadhan | Software Quality Assurance | Readynaz` |
| Portfolio | `Portfolio | Readynaz` |
| Project detail | `{project.name} | Portfolio | Readynaz` |
| About | `About Readynaz | Readynaz` |
| Raksara docs | `Raksara Documentation | Readynaz` or `Raksara Docs` |

Avoid making `Raksara` the default suffix for every page unless the page is specifically about the Raksara platform.

### 4.4 Generate unique meta descriptions

Recommended rules:

- Homepage: concise personal-brand description.
- Blog post: use frontmatter `description` or first meaningful excerpt.
- Profile: summarize role, expertise, and collaboration intent.
- Project pages: summarize problem, stack, and outcome.
- Tags/categories: describe the topic only if enough content exists; otherwise consider `noindex, follow`.

Example homepage description:

```html
<meta name="description" content="Readynaz is the personal site of Yunaz Gilang Ramadhan, covering software quality assurance, test automation, Java engineering, Raksara, Testara, and personal writing." />
```

### 4.5 Add canonical URLs

Every indexable page should include a self-referencing canonical URL.

```html
<link rel="canonical" href="https://readynaz.com/blog/post/stay-productive-with-github/" />
```

Rules:

- Use one trailing-slash convention consistently.
- Redirect non-canonical variants.
- Avoid duplicate paths such as `/blog` and `/blog/` both being independently indexable.

### 4.6 Add Open Graph and Twitter metadata

For every indexable page:

```html
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description}" />
<meta property="og:url" content="{canonicalUrl}" />
<meta property="og:type" content="article" />
<meta property="og:image" content="{absoluteImageUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{description}" />
<meta name="twitter:image" content="{absoluteImageUrl}" />
```

Use `og:type=website` for homepage and listing pages, and `og:type=article` for posts.

---

## Phase 3 — Structured Data

### 4.7 Homepage: `WebSite` + optional `Person`

Add `WebSite` JSON-LD on the homepage:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Readynaz",
  "url": "https://readynaz.com/",
  "description": "Personal site of Yunaz Gilang Ramadhan covering software quality assurance, automation, engineering, and writing.",
  "publisher": {
    "@type": "Person",
    "name": "Yunaz Gilang Ramadhan"
  }
}
```

If site search is public and stable, add `SearchAction`. If not, skip it.

### 4.8 Profile page: `ProfilePage` + `Person`

```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "name": "Yunaz Gilang Ramadhan",
    "jobTitle": "Software Quality Assurance",
    "url": "https://readynaz.com/profile/",
    "knowsAbout": [
      "Software Quality Assurance",
      "Test Automation",
      "Java",
      "Spring Boot",
      "Selenium",
      "API Testing"
    ],
    "sameAs": [
      "https://github.com/ygrip"
    ]
  }
}
```

Add LinkedIn and Medium URLs if they are stable and public.

### 4.9 Blog post page: `BlogPosting`

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Stay Productive with GitHub",
  "description": "A simple workflow combining GitHub Actions, Testcontainers, Maven Central, and GitHub Pages can automate testing, publishing, and documentation for Java projects.",
  "datePublished": "2026-03-16",
  "dateModified": "2026-03-16",
  "author": {
    "@type": "Person",
    "name": "Yunaz Gilang Ramadhan",
    "url": "https://readynaz.com/profile/"
  },
  "publisher": {
    "@type": "Person",
    "name": "Yunaz Gilang Ramadhan"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://readynaz.com/blog/post/stay-productive-with-github/"
  },
  "image": [
    "https://readynaz.com/path/to/post-image.png"
  ]
}
```

### 4.10 Breadcrumbs: `BreadcrumbList`

Apply to blog posts, project pages, tag pages, and category pages.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Blog",
      "item": "https://readynaz.com/blog/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Stay Productive with GitHub",
      "item": "https://readynaz.com/blog/post/stay-productive-with-github/"
    }
  ]
}
```

---

## Phase 4 — Crawl Infrastructure

### 4.11 Verify robots.txt

Recommended `/robots.txt`:

```txt
User-agent: *
Allow: /

Sitemap: https://readynaz.com/sitemap.xml
```

If admin routes, preview routes, draft APIs, or internal endpoints exist, block those explicitly:

```txt
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /drafts/
```

Do not block public blog, profile, portfolio, tag, or category pages.

### 4.12 Generate sitemap.xml

Include only canonical, indexable public URLs:

- Homepage.
- Blog index.
- Published blog posts.
- Profile.
- Portfolio index and project detail pages.
- Gallery if useful and content-rich.
- Thoughts if useful and content-rich.
- Tag/category pages only if they have enough unique content.

Example sitemap entry:

```xml
<url>
  <loc>https://readynaz.com/blog/post/stay-productive-with-github/</loc>
  <lastmod>2026-03-16</lastmod>
</url>
```

Implementation options:

- Generate sitemap during SvelteKit build.
- Derive URLs from the same content manifest used by the app.
- Use post frontmatter `dateModified` if available; otherwise fallback to `datePublished`.

Acceptance criteria:

- `/sitemap.xml` returns HTTP 200.
- Every sitemap URL returns HTTP 200.
- No redirected, 404, draft, or duplicate URL appears in sitemap.
- Sitemap submitted in Google Search Console.

---

## Phase 5 — Content and Information Architecture

### 5.1 Strengthen homepage H1 and hero copy

Recommended homepage H1:

```html
<h1>Readynaz — Engineering, Automation, and Personal Writing</h1>
```

Recommended supporting copy:

```text
Personal site of Yunaz Gilang Ramadhan, covering software quality assurance, test automation, Java engineering, Raksara, Testara, and reflective writing.
```

Why:

- It clarifies the site topic immediately.
- It aligns with search intent around Yunaz, QA automation, engineering writing, and Raksara/Testara.
- It avoids an empty or purely decorative heading.

### 5.2 Split About and Raksara documentation

Recommended routes:

- `/about/` = about Readynaz, Yunaz, purpose, topics, contact/collaboration.
- `/raksara/` = Raksara overview.
- `/raksara/docs/` = component documentation.
- `/portfolio/raksara/` = project case study.

This prevents the About page from ranking for the wrong intent.

### 5.3 Build topical clusters

Recommended clusters:

#### Cluster A — Test Automation / QA Engineering

Pillar page:

- `/topics/test-automation/`

Supporting posts:

- Selenium scraping with Testara.
- Engine-agnostic test recording.
- mitmproxy-grid Java client SDK.
- Cucumber JUnit 5 runner.
- Testara agentic skill.
- Observability for automation logs and traces.

#### Cluster B — GitHub-Native CMS / Raksara

Pillar page:

- `/topics/raksara/`

Supporting posts:

- Raksara SvelteKit migration.
- GitHub-based CMS dashboard.
- Cloudflare worker backend.
- GitHub Pages deployment.
- SEO fixes for static SvelteKit blogs.

#### Cluster C — Engineering Productivity

Pillar page:

- `/topics/engineering-productivity/`

Supporting posts:

- Stay productive with GitHub.
- AI as pair programmer.
- Engineers in the era of AI.
- Tooling and automation workflow.

### 5.4 Improve post template quality

Each post should have:

- One clear H1.
- A 1–2 sentence summary near the top.
- Published date and modified date.
- Author link to `/profile/`.
- Table of contents for long posts.
- Clear H2/H3 hierarchy.
- Related posts section.
- Canonical URL.
- BlogPosting JSON-LD.
- Social image.

Recommended frontmatter:

```yaml
title: "Stay Productive with GitHub"
description: "A practical workflow for automating Java project testing, publishing, and documentation with GitHub Actions, Testcontainers, Maven Central, and GitHub Pages."
date: "2026-03-16"
updated: "2026-03-16"
author: "Yunaz Gilang Ramadhan"
category: "engineering"
tags:
  - github
  - automation
  - ci-cd
  - java
  - devops
image: "/assets/blog/stay-productive-with-github/cover.png"
canonical: "https://readynaz.com/blog/post/stay-productive-with-github/"
draft: false
noindex: false
```

---

## Phase 6 — Tags, Categories, and Thin Pages

### 6.1 Decide index policy

Index tag/category pages only when they provide real discovery value.

Recommended policy:

| Page Type | Condition | Robots Meta |
|---|---|---|
| Category page | 3+ posts and intro text exists | `index, follow` |
| Tag page | 3+ posts and intro text exists | `index, follow` |
| Sparse tag page | 1–2 posts only | `noindex, follow` |
| Search results page | Internal search only | `noindex, follow` |
| Sort/filter parameter pages | Duplicate list state | `noindex, follow` or canonical to base page |

### 6.2 Add intro text to important category pages

Example for automation:

```text
Posts about test automation, Selenium, Playwright, Cucumber, API testing, observability, and QA engineering workflows.
```

This gives tag/category pages unique value instead of being pure duplicate lists.

---

## Phase 7 — Image SEO and Social Sharing

### 7.1 Image best practices

For post cards and hero images:

- Use descriptive `alt` text.
- Include `width` and `height` attributes to reduce layout shift.
- Use compressed WebP/AVIF where supported.
- Use responsive `srcset` if images are large.
- Preload or eagerly load the LCP hero image only on detail pages.
- Lazy-load non-critical images.

Example:

```html
<img
  src="/assets/blog/raksara-sveltekit/cover.webp"
  width="1200"
  height="630"
  alt="Raksara SvelteKit migration dashboard and blog layout preview"
  loading="eager"
  fetchpriority="high"
/>
```

### 7.2 Social preview image strategy

Use consistent 1200×630 images for:

- Homepage.
- Profile.
- Each blog post.
- Major project pages.

Recommended visual style:

- Readynaz/Setara visual language.
- Clear title text.
- Small brand mark.
- Topic label.
- High contrast.

---

## Phase 8 — Performance and Technical SEO

### 8.1 Core Web Vitals targets

| Metric | Target |
|---|---:|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| TTFB | As low as practical for static hosting |

### 8.2 SvelteKit/static optimization checklist

- Enable prerender for public routes.
- Split large JS bundles.
- Avoid shipping markdown parser to the browser for static posts.
- Pre-render code highlighting during build if possible.
- Defer non-critical scripts.
- Use static image optimization.
- Ensure fonts use `font-display: swap`.
- Minimize third-party scripts.
- Cache static assets aggressively with hashed filenames.

### 8.3 Accessibility and SEO overlap

- Ensure every page has one H1.
- Use semantic landmarks: `<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`.
- Make card click targets accessible without nesting multiple conflicting links.
- Add visible focus states.
- Use descriptive link text instead of generic `View all` where possible.
- Make search input label accessible.

---

## 9. Validation Workflow

### 9.1 Local validation

Run these checks after implementation:

```bash
npm run build
npm run preview
```

Then inspect:

```bash
curl -L https://readynaz.com/ | grep -i "<h1"
curl -L https://readynaz.com/blog/post/stay-productive-with-github/ | grep -i "GitHub Actions"
curl -L https://readynaz.com/sitemap.xml
curl -L https://readynaz.com/robots.txt
```

### 9.2 SEO validation tools

Use:

- Google Search Console URL Inspection.
- Google Rich Results Test.
- Google PageSpeed Insights.
- Lighthouse.
- Screaming Frog or a similar crawler.
- Browser `view-source:` for initial HTML verification.

### 9.3 Search Console follow-up

After deploying:

1. Submit sitemap.
2. Inspect homepage.
3. Inspect 3–5 representative blog posts.
4. Request indexing for fixed URLs.
5. Monitor indexing status for 2–4 weeks.
6. Watch for structured data errors.
7. Watch query impressions for Yunaz, Readynaz, Raksara, Testara, test automation, GitHub CMS, and SvelteKit blog terms.

---

## 10. Implementation Checklist

### P0 Checklist

- [ ] Blog post body is present in initial HTML.
- [ ] About page no longer shows `Loading…` as primary content.
- [ ] Homepage has a meaningful H1.
- [ ] All public routes have unique `<title>`.
- [ ] Raksara branding is not incorrectly used as the default title suffix.

### P1 Checklist

- [ ] Unique meta descriptions for homepage, profile, blog index, and posts.
- [ ] Self-referencing canonical tags.
- [ ] Open Graph metadata.
- [ ] Twitter card metadata.
- [ ] `WebSite` JSON-LD on homepage.
- [ ] `Person` or `ProfilePage` JSON-LD on profile.
- [ ] `BlogPosting` JSON-LD on posts.
- [ ] `BreadcrumbList` JSON-LD on posts.
- [ ] Valid `/sitemap.xml`.
- [ ] Valid `/robots.txt` with sitemap reference.

### P2 Checklist

- [ ] Tag/category index policy implemented.
- [ ] Sparse tags are `noindex, follow`.
- [ ] Important categories have intro copy.
- [ ] Related posts added to article template.
- [ ] Post template includes author link.
- [ ] Images have width/height and descriptive alt text.
- [ ] Social images are consistent and absolute URLs.
- [ ] Internal topic cluster pages created.

---

## 11. Recommended Final Architecture

```text
readynaz.com/
├── /                         # Homepage: Readynaz brand and latest content
├── /profile/                 # Person/profile SEO target
├── /about/                   # About the site and creator
├── /blog/                    # Blog index
├── /blog/post/{slug}/        # Full SSR/prerendered articles
├── /portfolio/               # Project index
├── /portfolio/{slug}/        # Project case studies
├── /topics/test-automation/  # Topic pillar
├── /topics/raksara/          # Topic pillar
├── /topics/productivity/     # Topic pillar
├── /tags/{tag}/              # Conditional index/noindex
├── /categories/{category}/   # Conditional index/noindex
├── /raksara/docs/            # Raksara-specific docs
├── /sitemap.xml
└── /robots.txt
```

---

## 12. Success Metrics

Track these before and after implementation:

| Metric | Baseline | Target |
|---|---:|---:|
| Indexed blog posts | Current Search Console count | 90–100% of published posts indexed |
| Pages with only `Loading…` body | Current crawl count | 0 |
| Valid structured data items | Current count | All eligible posts valid |
| Duplicate/missing title issues | Current crawl count | 0 |
| Duplicate/missing meta description issues | Current crawl count | 0 |
| Organic impressions | Current GSC value | +20–50% over 8–12 weeks |
| Click-through rate for branded queries | Current GSC value | Improve with clearer titles/snippets |
| LCP | Current PSI value | < 2.5s |
| CLS | Current PSI value | < 0.1 |

---

## 13. Suggested Work Order for an AI Coding Agent

Use this as the implementation sequence:

1. Audit current SvelteKit/Raksara route structure.
2. Locate where markdown content is loaded and rendered.
3. Refactor post/about rendering so content is resolved at build/server load, not only in browser lifecycle.
4. Add a central SEO utility:
   - title builder
   - description builder
   - canonical builder
   - Open Graph builder
   - Twitter metadata builder
   - JSON-LD builder
5. Add route-specific metadata for homepage, blog, post, profile, portfolio, about, tags, and categories.
6. Add sitemap generator from content manifest.
7. Add robots.txt generation/static file.
8. Add structured data components.
9. Add tests:
   - `curl`/HTML snapshot test for article body presence.
   - metadata snapshot test.
   - sitemap URL validation test.
   - structured data JSON parse test.
10. Run Lighthouse and Search Console validation.

---

## 14. Notes and Assumptions

- This audit used publicly accessible crawl/search output, not authenticated repository access.
- The most important finding is based on the publicly visible rendered/crawled text where blog article body content appears as `Loading…`.
- If the source repository already has server-side rendering logic, verify deployment mode. A static adapter or GitHub Pages deployment can still accidentally ship a client-only loading state if content is not available at build time.
- Because Readynaz appears to be powered by Raksara, metadata should separate **site brand** from **platform brand** to prevent search results from showing the wrong primary identity.

---

## 15. Reference Sources

- Readynaz homepage: <https://readynaz.com/>
- Readynaz blog index: <https://readynaz.com/blog/>
- Sample post: <https://readynaz.com/blog/post/stay-productive-with-github/>
- Sample post: <https://readynaz.com/blog/post/extroverted-introvert-where-comfort-meets-change/>
- Readynaz profile: <https://readynaz.com/profile/>
- Readynaz about: <https://readynaz.com/about/>
- Google SEO Starter Guide: <https://developers.google.com/search/docs/fundamentals/seo-starter-guide>
- Google JavaScript SEO Basics: <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>
- Google Structured Data Introduction: <https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- Google Article Structured Data: <https://developers.google.com/search/docs/appearance/structured-data/article>
- Google Meta Description/Snippet Guide: <https://developers.google.com/search/docs/appearance/snippet>
