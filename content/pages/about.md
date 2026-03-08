---
title: "About Raksara"
---

# About Raksara

**Raksara** — derived from the Sanskrit word for "writing" — is a place where ideas, knowledge, and engineering thoughts are recorded.

## What is This?

This is a personal content platform built entirely on GitHub. Every page you see is rendered from Markdown files stored in a repository. There are no databases, no servers, and no CMS — just files and code.

## How It Works

1. **Write** content in Markdown with frontmatter metadata
2. **Push** to the repository
3. **GitHub Actions** automatically builds metadata indexes
4. **GitHub Pages** serves the static site

The entire pipeline is automated. Writing a new blog post is as simple as creating a `.md` file and pushing it.

## Philosophy

- **Simplicity** — No complex toolchains or build systems
- **Ownership** — Your content lives in your repository
- **Transparency** — Everything is open and version-controlled
- **Performance** — Static files served from a CDN

## Technical Details

- **Frontend:** Vanilla JavaScript with hash-based routing
- **Markdown:** Rendered client-side with Marked.js
- **Search:** Client-side full-text search with MiniSearch
- **Metadata:** Auto-generated JSON indexes for navigation, tags, and categories
- **Hosting:** GitHub Pages (free)

## Source

The source code for this platform is open and available on GitHub. Feel free to fork it and make it your own.
