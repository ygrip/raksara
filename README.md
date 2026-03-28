# Raksara

A GitHub-native static content platform that transforms a repository into a blog, portfolio, and personal site.

> Raksara — A place where ideas, knowledge, and engineering thoughts are recorded.

## Features

- **Blog** — Markdown-powered with frontmatter, pagination, tags, and categories
- **Portfolio** — Project showcase with GitHub/demo links
- **Gallery** — Image grid with lightbox viewer
- **Shower Thoughts** — Short-form content section
- **Collapsible TOC** — `::toc(...)` component with expand/collapse toggle (expanded by default)
- **Collapsible Long Code Blocks** — Long snippets start collapsed with fade indicator and expand/collapse control
- **Homepage Gallery Window** — Mac-like gallery stack card that opens the full gallery
- **Portfolio Timeline Controls** — Search and sort while preserving timeline-style visual grouping
- **Profile** — Parallax hero with avatar, cover, and social links
- **Search** — Client-side full-text search powered by MiniSearch
- **Optimized Build Output** — Rollup vendor bundle + Terser JS minification + cssnano CSS minification + HTML/JSON minification
- **Navigation Tree** — Auto-generated content tree sidebar
- **Light/Dark Theme** — Glassmorphism UI with animated gradients
- **Configurable Accent Color** — Choose from 6 color presets (purple, blue, red, yellow, green, orange) via `raksara.yml`
- **Giscus Comments (Optional)** — GitHub Discussions-powered comments for blog and portfolio detail pages, configurable via `raksara.yml` with per-post override
- **Share Anywhere** — Share button on posts, directories, gallery, thoughts, and portfolio pages; copies `Title : URL` to clipboard or opens native share sheet
- **GitHub Pages** — Automatic deployment via GitHub Actions

## Architecture

Raksara separates the **engine** (this repo) from **content** (a separate private repo). This repo is a clean, forkable template — your personal content lives in its own repository.

```
raksara/                          your-content-repo/
  web/              (frontend)      blog/
  scripts/          (build)         portfolio/
  content-template/ (skeleton)      gallery/
  .github/workflows/                thoughts/
  sync.yml          (trigger)       pages/
  package.json                      assets/images/
                                    raksara.yml  (site config)
                                    .github/workflows/
```

At build time, GitHub Actions checks out your content repo into `content/`, runs the metadata build, and deploys to GitHub Pages.

## Quick Start

### 1. Fork this repo

Fork `ygrip/raksara` to your own GitHub account.

### 2. Create a private content repo

Create a new private repository for your content. Use `content-template/` in this repo as a starting point:

```bash
# Clone your new content repo
git clone git@github.com:you/your-content.git
cd your-content

# Copy the template structure
cp -R /path/to/raksara/content-template/* .

# Edit the example files, then commit and push
git add . && git commit -m "Initial content" && git push
```

See `CONTENT_GUIDE.md` for detailed authoring instructions.

### 3. Configure GitHub secrets and variables

**On your forked Raksara repo:**

| Type | Name | Value |
|------|------|-------|
| Variable | `CONTENT_REPO` | `you/your-content` (owner/repo) |
| Variable | `SITE_URL` | `https://you.github.io` or your custom domain |
| Secret | `CONTENT_PAT` | A GitHub PAT with `repo` scope to read your private content repo |

**On your content repo:**

| Type | Name | Value |
|------|------|-------|
| Variable | `RAKSARA_REPO` | `you/raksara` (owner/repo of your fork) |
| Secret | `RAKSARA_PAT` | A GitHub PAT with `repo` scope to trigger dispatch on your fork |

### 4. Trigger a build

Either:
- **Push content** to your content repo (auto-triggers via `repository_dispatch`)
- **Bump `sync.yml`** version in this repo and push
- **Manual dispatch** from the Actions tab in GitHub

## Rebuilding Your Site

There are three ways to trigger a rebuild:

### Automatic (recommended)

Push content to your private content repo. Its workflow automatically notifies this repo to rebuild and deploy.

### Manual bump

Edit `sync.yml` at the repo root and increment the version:

```yaml
version: 2   # was 1
```

Push the change — the deploy workflow runs on any push to `main`.

### GitHub Actions UI

Go to Actions > Deploy Site > Run workflow.

## Local Development

```bash
# Install dependencies
npm install

# Prepare sibling content repo
git clone git@github.com:you/raksara-content.git ../raksara-content

# Build metadata (script will create content -> ../raksara-content symlink,
# then remove it automatically after build)
npm run build

# Serve locally
npm run dev
```

### Build output optimization

`npm run build` now performs additional optimization steps:

- Bundles route-scoped vendors using Rollup:
  - `web/vendor-markdown.min.js` for Markdown rendering (`marked`), loaded only on markdown-heavy routes
  - `web/vendor-search.min.js` for search (`minisearch`), loaded only when opening search overlay
- Loads Highlight.js core and language modules on demand from `web/vendor/hljs/` per code block language
- Minifies `web/app.js` into `web/app.min.js` using Terser
- Minifies `web/styles.css` into `web/styles.min.css` using cssnano
- Minifies generated static HTML route files (including `web/index.html`) with `html-minifier-next`
- Writes compact JSON metadata (no pretty-print whitespace) for smaller payloads
- Generates a homepage gallery cover image (`web/content/assets/images/gallery-cover.webp`) used by prerendered homepage gallery window

### Local build behavior

- For local runs, the build script checks for `../raksara-content`.
- If found, it creates a temporary `content/` symlink before building.
- After the build finishes (success or failure), the symlink is removed.
- In CI (`GITHUB_ACTIONS=true`), this symlink behavior is skipped.

### SEO base URL source

- Sitemap and robots use environment variables, not YAML config.
- Supported variables (priority order):
  1. `SITE_URL` (recommended)
  2. `BASE_URL`
- If none is set, the build falls back to `https://<github-owner>.github.io` when possible.

## Project Structure

```
raksara/
├── content-template/     # Skeleton content structure for forkers
├── web/                  # Frontend (HTML, CSS, JS)
├── scripts/
│   └── build-metadata.js # Scans content/, generates JSON indexes + SEO artifacts
├── .github/
│   └── workflows/
│       └── deploy.yml    # CI/CD: checkout content, build, deploy
├── sync.yml              # Bump to trigger rebuild
└── package.json
```

## Tech Stack

- Vanilla JavaScript (no framework)
- [Rollup](https://rollupjs.org/) — Bundles browser vendor dependencies
- [Terser](https://github.com/terser/terser) — JavaScript minification
- [cssnano](https://cssnano.github.io/cssnano/) — CSS minification
- [html-minifier-next](https://github.com/j9t/html-minifier-next) — HTML minification
- [Marked](https://marked.js.org/) — Markdown rendering
- [Highlight.js](https://highlightjs.org/) — Code syntax highlighting
- [MiniSearch](https://lucaong.github.io/minisearch/) — Client-side search
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — Frontmatter parsing
- [fast-glob](https://github.com/mrmlnc/fast-glob) — File scanning
- [mermaid](https://github.com/mermaid-js/mermaid) — Diagram rendering

## License

Engine source code: MIT

Content is owned by the respective content repository author. The default content
template uses [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)
as a suggested license — adjust to your preference in your content repo.
