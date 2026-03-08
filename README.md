# Raksara

A GitHub-native static content platform that transforms a repository into a blog, portfolio, and personal site.

> Raksara — A place where ideas, knowledge, and engineering thoughts are recorded.

## Features

- **Blog** — Markdown-powered blog with frontmatter metadata, pagination, tags, and categories
- **Portfolio** — Project showcase with GitHub/demo links
- **Profile** — Markdown-based profile page
- **Search** — Client-side full-text search powered by MiniSearch
- **Navigation Tree** — Auto-generated content tree sidebar
- **Tags & Categories** — Filter and browse content by metadata
- **Dark Theme** — Beautiful dark UI built with modern CSS
- **GitHub Pages** — Automatic deployment via GitHub Actions

## Quick Start

```bash
# Install dependencies
npm install

# Build metadata from content
npm run build

# Serve locally
npm run dev
```

## Project Structure

```
raksara/
├── content/
│   ├── blog/          # Markdown blog posts
│   ├── portfolio/     # Project descriptions
│   ├── pages/         # Static pages (profile, about)
│   └── assets/        # Images and other assets
├── metadata/          # Auto-generated JSON indexes
├── web/               # Frontend (HTML, CSS, JS)
├── scripts/
│   └── build-metadata.js
└── .github/
    └── workflows/
        └── deploy.yml
```

## Writing Content

### Blog Post

Create a `.md` file in `content/blog/`:

```yaml
---
title: "My Post Title"
date: 2026-03-01
tags:
  - javascript
  - webdev
category: engineering
summary: "A brief summary of the post"
---

Your markdown content here...
```

### Portfolio Entry

Create a `.md` file in `content/portfolio/`:

```yaml
---
title: "Project Name"
type: project
tags:
  - go
  - devops
category: tools
github: "https://github.com/user/project"
demo: "https://project.dev"
summary: "What the project does"
---

Detailed project description...
```

## Deployment

Push to `main` branch. GitHub Actions will automatically:

1. Install dependencies
2. Build metadata indexes
3. Deploy to GitHub Pages

## Tech Stack

- Vanilla JavaScript (no framework)
- [Marked](https://marked.js.org/) — Markdown rendering
- [Highlight.js](https://highlightjs.org/) — Code syntax highlighting
- [MiniSearch](https://lucaong.github.io/minisearch/) — Client-side search
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — Frontmatter parsing
- [fast-glob](https://github.com/mrmlnc/fast-glob) — File scanning

## License

MIT
