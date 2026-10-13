---
title: "Creating Content with the Raksara Admin Dashboard"
date: 2026-05-19
summary: "A guided workflow for creating blog posts, portfolio items, gallery entries, and more — with live preview and custom component support."
tags:
  - admin
  - workflow
  - content-creation
draft: true
---

# Creating Content with the Raksara Admin Dashboard

The Raksara Admin Dashboard provides a guided, browser-based interface for creating and submitting new content — from blog posts and portfolio projects to gallery images and documentation pages. No manual file editing required.

## Access & Authentication

The dashboard uses a two-layer authentication model:

1. **Admin challenge code** — A shared passphrase that unlocks the admin workspace on your device (24-hour cookie, `Secure` flag on HTTPS)
2. **GitHub OAuth** — Signs you in with your GitHub account and verifies you're in the repository's `allowedAuthors` list

Once authenticated, you can create content for any of five content types:

- **Blog** — Articles, essays, novels, poems
- **Portfolio** — Project pages with optional GitHub and demo links
- **Gallery** — Image-first entries with captions
- **Thoughts** — Short-form writing
- **Pages/Docs** — Static pages and documentation

## The Content Form

The form is split into focused sections:

### Metadata

- **Type** — Choose the content type (adjusts available fields and asset paths)
- **Title** — Auto-generates a kebab-case slug that you can edit
- **Date** — Defaults to today
- **Summary** — Short description for metadata and feeds
- **Tags** — Multi-select chip input with autocomplete suggestions from existing tags
- **Category** — Single-select field for grouping content

### Type-Specific Fields

Portfolio entries add:
- **Status** — Planned, Ongoing, Completed, Archived, or Paused (color-coded)
- **GitHub URL** — Repository link (validated)
- **Demo URL** — Live site link (validated)

### Body Editor

The body uses a **Write / Preview toggle**:

- **Write mode** — Monospaced textarea with a toolbar for inserting custom components
- **Preview mode** — Real-time rendering of headings, bold/italic, code, fenced code blocks, images, links, and component directive placeholders

The **component toolbar** (when enabled) shows all available Raksara components grouped by type:
- **Directive** — `::toc`, `::chapters`, `::component-list`, `::file`
- **HTML blocks** — `<panel>`, `<container>`, `<chip>`, `<grid>`, `<rk-progress>`, `<thought>`
- **Code** — `chart` and `mermaid` fenced blocks
- **Enhancement** — Video player embeds and sortable tables

Click any component button and its snippet inserts at your cursor position.

### Assets

Upload one or more images:
- Files are automatically placed in a type-specific path: `content/assets/images/{type}/{slug}/`
- Set **alt text** for accessibility
- Set **captions** for display
- Portfolio and gallery entries can use a cover image from the first upload

## Creating a Pull Request

When you submit the form:

1. **Validation** — Checks for duplicate slugs, valid URLs, required fields
2. **PR creation** — Creates a new branch, commits your markdown + uploaded assets, and opens a pull request on GitHub
3. **Draft flag** — All new posts are marked `draft: true` in frontmatter for review before publishing
4. **Success toast** — Shows the PR number and direct link to GitHub

You can then review the PR, make adjustments on the branch, get feedback from collaborators, and merge when ready.

## Pull Requests Tab

View all open pull requests created from the admin dashboard:
- PR number, title, branch name, and author
- Direct link to the GitHub PR for review
- Auto-refreshes when you create new content

## Why This Approach?

The dashboard keeps GitHub as the source of truth:
- ✓ No separate database
- ✓ Full version history
- ✓ Collaborative review via PR
- ✓ Auditable changes
- ✓ Safe publishing workflow

Content remains portable — you can always edit files directly in GitHub if needed.

## Security

The admin panel includes several layers of protection:

- **Turnstile CAPTCHA** (optional) — Protects GitHub OAuth in production
- **CSRF tokens** — Validated on all write operations
- **Rate limiting** — Per-IP limits on reads and writes
- **Allowed authors** — Server-side verification against `raksara.yml`
- **File validation** — Asset extensions, file sizes, markdown length all enforced
- **Secure cookies** — Session and challenge cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options on all responses

## Next Steps

Phase 11 will add **previous/next selection** — choose which posts link to each other in navigation sequences.

Future phases may include:
- PR preview rendering
- Draft management (view/edit unpublished content)
- Scheduled publishing
- Bulk operations

For now, the dashboard provides a clean, guided path from idea to pull request — keeping the friction low and the control high.
