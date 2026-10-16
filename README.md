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

### Homepage project references

Keep the animated hero and add optional, crawlable links to the work mentioned in its copy. In the content repository's `homepage.yaml`:

```yaml
hero:
  links:
    - label: My test framework
      href: /portfolio/testara/
```

These links supplement (not replace) `hero.actions` and render in the static HTML. Sites without `hero.links` keep their existing hero content.

### Heritage rendering

The heritage theme uses Cormorant for editorial headings and link-directory labels, with Jakarta for body copy. Accent-colored ukiran frames and dividers preserve the Nusantara identity; GitHub stays a secondary outlined action and Demo uses a filled accent action.

The divider mask is a 10.7 KiB WebP, decoded only after the page `load` event and an idle callback. A hairline remains if loading fails or data saving is enabled, with space reserved so the ornament does not shift content.

Portfolio entries with `featured: true` in their Markdown frontmatter get a brief, accent-colored border trace on hover or focus, on both the homepage and portfolio listing. The trace runs once per interaction, preserves the carved corner and card tilt, and adds no runtime dependency. Touch does not trigger hover motion; reduced-motion and forced-colors preferences disable the decorative trace without removing focus outlines.

Homepage primary buttons get a single 500ms accent sheen on fine-pointer hover or keyboard focus. It paints behind the label without replacing the carved lotus. Secondary controls remain quiet; reduced motion, reduced transparency, forced colors, and print disable the sheen.

Cards, buttons, and mobile frames use painted frost instead of backdrop filters. Title shimmer and avatar breathing are removed. Ambient fireflies (16 on desktop, 6 on mobile) load after the page in two stages. First they twinkle in place with opacity-only Web Animations on the compositor; DOM fireflies cannot drift cheaply, because with IntersectionObservers on the page Chrome recomputes intersections on the main thread every frame a transform animates (roughly a fifth of a desktop core). Then, in an idle slot, a worker takes over on an `OffscreenCanvas` and the fireflies wander and flare at 30 fps; worker frames go straight to the compositor, so the drift adds no main-thread work. Browsers without `transferControlToOffscreen` keep the twinkle. The worker pauses when the tab is hidden or reading mode is on, follows theme and accent changes, and draws a still frame for reduced motion. Fireflies are skipped for data saving, reduced transparency and forced colors.

The dot field samples the first portrait once its images are decoded off the main thread; later images are sampled in idle slots, and the morph loop starts when the second lands. The resting grid is a repeated tile pattern, the entrance is a one-shot CSS clip reveal, and morphs, theme inversions and pointer effects run at the display rate (capped near 60 fps) while repainting only the region the dots occupy. Held images do not repaint; the field suspends offscreen or hidden. Dots ramp from a saturated accent body (`--dot-field-color`) to a hot highlight (`--dot-field-hot`). Desktop backing resolution is capped at 1.5× (1× on small/coarse-pointer devices). Reduced motion keeps a static field.

Share images (1080×1080 PNG) use the same Heritage Glass look in the current theme: accent dot grid and fireflies behind a frosted plate with carved ukiran corners and spines, Cormorant titles over Jakarta body text, and a medallion footer with the site's configured logo (`config.logo`, falling back to `/favicon.svg`) and host.

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
npm run test:taxonomy:policy # Check taxonomy policy and URL encoding
# Against a running dev/preview server (install Chromium with npx playwright install chromium):
TAXONOMY_BASE_URL=http://localhost:5173 npm run test:taxonomy
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

Raksara is deployed to GitHub Pages, so indexable pages must exist as static HTML, not only as client-side routes. The metadata build writes an explicit static-route manifest to `sveltekit/static/metadata/prerender-routes.json`; sitemap URLs are the indexable subset of those routes. Prerendered does not necessarily mean indexable: the manifest also includes shared taxonomy shells and other intentional static utility pages.

During `npm run build:sveltekit`, SvelteKit reads that manifest with link crawling disabled. Every sitemap URL must have matching HTML in `sveltekit/build`.

### Hybrid tag and category archives

Opt selected tag archives into static rendering and indexing explicitly in the **content repository's** `raksara.yml`:

```yaml
taxonomy:
  highlighted_tags: [java]

topics:
  java:
    title: Java
    intro: Java engineering articles, implementation patterns, and tooling.
```

Use exact, case-sensitive tag names that exist in visible content, with a `topics` title and intro (or description) for each highlighted tag. Highlighted names must be safe path slugs (letters, digits, hyphens and underscores, starting with a letter or digit); other terms, including Unicode and punctuation, are supported by query shells. The `topics` block supplies presentation only; it never implicitly highlights a tag. Omitting `taxonomy.highlighted_tags` means no highlighted tags. Deploy the configuration in the content branch used by the production workflow, not only a local generated `config.json`.

- Highlighted tags retain `/tag/java/`: a crawler-readable initial result page, `index, follow`, self-canonical and collection structured data; included in the sitemap. Each result page contains at most 30 items; later pages load in the browser.
- Other tags use `/tag/?name=cucumber`; categories use `/category/?name=Engineering`. Both routes have real static HTML shells containing `noindex, follow` before JavaScript. Their selected detail is loaded in the browser; they have no canonical or sitemap entries.
- `/tags/` and `/categories/` remain searchable, bounded taxonomy directories. Generated chips resolve to the highlighted static route or the appropriate query shell with safely encoded names.
- Detail data is generated under `/metadata/taxonomy/`: a compact term registry and paginated, per-term result files. A view fetches the selected page and relevant image metadata instead of the full post/project/gallery arrays. Counts reflect visible archive scope: tags include posts, projects, thoughts and gallery; categories include posts, projects and gallery. Page/document-only terms are excluded.

Old non-highlighted `/tag/name/` and `/category/name/` paths have best-effort client navigation to the new query URL. **GitHub Pages still returns HTTP 404 on an initial request to a removed path**; a client redirect is not an HTTP 301. Configure and verify permanent redirects at a hosting/edge layer if preserving HTTP-level legacy navigation and backlinks is required. GitHub Pages does not process a `_redirects` file. Promotion/demotion of highlights changes this legacy policy, so review existing traffic and links before changing the allowlist.

Build validators require exact highlighted sitemap/manifest membership, no stale long-tail archive HTML, both physical noindex shells, and bounded taxonomy metadata. Browser checks cover the directories, shell navigation, pagination, failure/retry and encoded terms. Test deployed HTTP statuses separately: a dev or preview server may hide Pages' fallback behavior.

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

### Optional: submit the sitemap to Google Search Console

1. In a Google Cloud project, [enable the Search Console API](https://developers.google.com/webmaster-tools/v1/prereqs). Create a service account and a JSON key; keep the key out of Git.
2. Verify your production site in Search Console. Add the service account's `client_email` as a **delegated owner** under the property's **Settings → Users and permissions**, using a verified-owner account. It needs access to the exact property used below; Google Cloud IAM roles alone do not grant Search Console access.
3. Configure these settings in the engine repository (or its `github-pages` environment):

   | Type | Name | Value |
   |---|---|---|
   | Variable | `GSC_SITE_URL` | Exact Search Console property ID: `sc-domain:example.com` or `https://example.com/` (include the URL-prefix property's trailing slash/path) |
   | Secret | `GSC_SERVICE_ACCOUNT_JSON` | Complete service-account JSON key |

4. Run **Deploy Site**. After deployment and the optional cache purge, the workflow authenticates and submits the sitemap URL (`SITE_URL` without a trailing slash, followed by `/sitemap.xml`) directly to the [Search Console sitemap submission API](https://developers.google.com/webmaster-tools/v1/sitemaps/submit). It does not fetch the website or compare sitemap contents. Authentication and submission failures emit warnings, not failed deployments. Leave `GSC_SITE_URL` unset to disable submission.

Google fetches the sitemap separately, so it must remain accessible to Google. Successful submission tells Google where the sitemap is; it does **not** guarantee crawling or indexing. Check the property's Sitemaps report for processing results. Rotate the JSON key as a credential and remove its repository secret when no longer needed.

Google documentation: [API authorization and scope](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [service-account property access](https://developers.google.com/search/apis/indexing-api/v3/prereqs). The latter documents service-account access; this workflow uses the **Search Console API**, not the Indexing API.

Do not use Google's [retired sitemap-ping endpoint](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping). The [Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart) only supports job-posting pages and livestream pages (`JobPosting`, or `BroadcastEvent` embedded in `VideoObject`), not ordinary blog or portfolio pages.

Local regression checks: `python3 scripts/test-submit-sitemap.py`.

## Sensitive Data

Do not commit actual secrets, tokens, private content, or generated build output. The repo ignores `content/`, `.env*`, `metadata/`, `sveltekit/build/`, and generated SvelteKit static content/metadata assets. Keep deploy credentials in GitHub Actions secrets.

## License

Engine source code: MIT.

Content is owned by the respective content repository author. The default content template suggests CC BY-NC-ND 4.0; adjust that in your content repo as needed.
