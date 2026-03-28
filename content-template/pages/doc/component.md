---
title: "Component List"
summary: "Auto-generated, searchable, clickable card grid from any directory's markdown metadata"
icon: "🗂️"
status: "available"
previous_page:
  title: "Chapters Table"
  link: "#/doc/chapters"
---

# Component List

Use `::component(path/dir)` to render a searchable, clickable card list auto-generated from the metadata of every markdown file in the specified directory. It's designed for documentation indexes, project listings, and any grouped content overview.

## Syntax

```markdown
::component(pages/doc)
::component(portfolio)
::component(blog/my-series)
```

The argument is a path relative to your content root. Raksara scans its metadata for all entries whose path starts with that prefix.

## What It Renders

Each entry in the directory becomes a **clickable card** showing:

- An **icon** (from the `icon` frontmatter field, optional)
- The **title** (from `title` frontmatter)
- A **status badge** (from `status` frontmatter, optional)
- A **description** excerpt (from `summary` or `description`, ellipsized to 2 lines)
- A **"See more →"** link

The whole card is a link — clicking anywhere on it navigates to the entry's page.

A **search field** above the list lets readers filter cards in real-time by title or description.

## Frontmatter Fields Used

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Card heading |
| `summary` | No | Description excerpt shown on the card |
| `icon` | No | Emoji or short text shown before the title |
| `status` | No | Status badge text (`available`, `wip`, `draft`, `deprecated`) |

## Status Badge Colors

| Value | Color |
|---|---|
| `available` | Accent (green/teal) |
| `wip` / `draft` | Amber |
| `deprecated` | Red |

## Example — Documentation Index

```markdown
---
title: "Documentation"
---

Browse all available components:

::component(pages/doc)
```

This generates the search + card list you're reading right now.

## Example — Portfolio Overview

```markdown
## Projects

::component(portfolio)
```

Renders a filterable list of all portfolio entries with their summaries.

<panel type="note">
`::component()` reads from built metadata — run `npm run build` after adding or editing files in the target directory to reflect changes.
</panel>

<panel type="info">
The search field filters by **title** and **description** simultaneously. Matching is case-insensitive and works on partial strings.
</panel>
