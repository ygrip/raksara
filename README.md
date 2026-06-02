# Raksara

A GitHub-native SvelteKit content site for blogs, portfolios, galleries, notes, and custom Markdown components.

Raksara keeps the engine in this repository and the content in a separate repository. During local development the engine can read a sibling `../raksara-content` repo through the `content` symlink created by the metadata build.

## Features

- SvelteKit static site output for GitHub Pages
- Markdown blog posts with nested directories, tags, categories, breadcrumbs, next/previous navigation, and reading mode
- Portfolio pages with GitHub/demo links and project status
- Gallery list with image lightbox, per-image URLs, captions, filtering, and share cards
- Profile page with cover, avatar, metadata chips, animation, and share support
- Custom Markdown components: panels, containers, chips, sortable tables, charts, progress bars, videos, files, table of contents, chapters tables, responsive card grids (`::cards`), and infinite-loop carousels (`::carousels`)
- Homepage fully configurable from `homepage.yaml` in the content repo — hero eyebrow/title/subtitle/description/CTA buttons, ordered sections (blog, projects, cards, links, gallery, thoughts, text), per-section category filtering and limits
- Highlight.js code blocks with copy, expand/collapse, and mobile-friendly controls
- Giscus comments for blog and portfolio detail pages
- Light/dark theme and configurable accent color from `config.json`
- Generated metadata, search index, SEO artifacts (sitemap with image extensions, robots.txt, JSON-LD), responsive images, favicons, and static vendor assets
- RSS (`/feed.xml`) and Atom (`/atom.xml`) feeds for blog discovery
- WebSite + Person JSON-LD structured data on homepage; BreadcrumbList + BlogPosting/SoftwareApplication on content pages

## Repository Layout

```text
raksara/
  sveltekit/          SvelteKit frontend and static assets
  scripts/            Metadata, responsive image, SEO, and vendor asset build
  content-template/   Starter content repo structure
  metadata/           Generated metadata, ignored by git
  content/            External content checkout or local symlink, ignored by git
  .github/workflows/  GitHub Pages deployment
  sync.yml            Optional rebuild trigger marker
```

The legacy `web/` frontend has been removed. `sveltekit/build/` is the deploy artifact.

## Local Development

```bash
npm install
cd sveltekit && npm install && cd ..

# Optional: clone content beside this repo
# git clone git@github.com:you/raksara-content.git ../raksara-content

# Build metadata and start SvelteKit
npm run dev
```

Useful commands:

```bash
npm run build:metadata      # Generate metadata and static assets
npm run validate:seo:build  # Validate sitemap, robots, prerender manifest, and SEO config
npm run validate:seo:dist   # Validate built HTML after SvelteKit output exists
npm run dev                 # Build metadata, then run SvelteKit dev server
npm run check:sveltekit     # Type/check SvelteKit
npm run build               # Build metadata, validate SEO, then SvelteKit static output
```

The metadata build writes to:

- `metadata/*.json`
- `sveltekit/static/metadata/*.json`
- `sveltekit/static/metadata/prerender-routes.json`
- `sveltekit/static/content/`
- `sveltekit/static/vendor*.js`
- `sveltekit/static/vendor/hljs/`
- `sveltekit/static/sitemap.xml`, `robots.txt`, `ads.txt`, favicons, and manifest
- `sveltekit/static/feed.xml` and `sveltekit/static/atom.xml`

## Static SEO Output

Raksara is deployed to GitHub Pages, so indexable pages must exist as static HTML, not only as client-side routes. The metadata build computes the canonical route list once, filters it with the same `isIndexableRoute()` logic used for `sitemap.xml`, and writes `sveltekit/static/metadata/prerender-routes.json`.

During `npm run build:sveltekit`, SvelteKit reads that manifest and prerenders exactly those indexable routes. Non-indexable routes such as gallery popups, tag/category archives, and utility pages can still use the static adapter fallback as SPA routes, but sitemap URLs should always have matching HTML in `sveltekit/build`.

For Google Search Console HTML-tag verification, add
`google_site_verification: <token>` to `raksara.yml`. Builds render
`<meta name="google-site-verification" content="<token>">`; SEO validation warns
when the token is not configured.

## Content Repository

Your content repository should contain:

```text
blog/
portfolio/
gallery/
thoughts/
pages/
assets/images/
raksara.yml
```

Use `content-template/` as a starting point. See [CONTENT_GUIDE.md](CONTENT_GUIDE.md) for frontmatter, custom Markdown components, and authoring details.

## GitHub Pages Deployment

Configure these repository variables/secrets on the engine repo:

| Type | Name | Purpose |
|---|---|---|
| Variable | `CONTENT_REPO` | Content repository in `owner/repo` form |
| Variable | `SITE_URL` | Published site URL |
| Secret | `CONTENT_PAT` | Token that can read the content repo |

The deploy workflow:

1. Checks out this engine repo.
2. Checks out the content repo into `content/`.
3. Installs root and SvelteKit dependencies.
4. Runs `npm run build:metadata`.
5. Runs `npm run build:sveltekit`.
6. Uploads `sveltekit/build` to GitHub Pages.

## Sensitive Data

Do not commit actual secrets, tokens, private content, or generated build output. The repo ignores `content/`, `.env*`, `metadata/`, `sveltekit/build/`, and generated SvelteKit static content/metadata assets. Keep deploy credentials in GitHub Actions secrets.

## License

Engine source code: MIT.

Content is owned by the respective content repository author. The default content template suggests CC BY-NC-ND 4.0; adjust that in your content repo as needed.
