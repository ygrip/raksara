---
title: "Chapters Table"
summary: "Sortable post listing from a blog directory, with expandable subdirectory rows and pagination"
icon: "📚"
status: "available"
---

# Chapters Table

Use `::chapters(path)` to render a sortable, paginated table of posts from any blog directory. It's designed for long-running series, novels, or any multi-part content collection.

## Syntax

```markdown
::chapters(/blog/novel/my-series)
::chapters(blog/novel/my-series)
```

The leading `/blog/` prefix is optional — both forms resolve to the same directory.

## What It Renders

- A table with **Title**, **Date**, and **Type** columns
- Clickable rows that navigate to the post
- Sortable column headers (click to sort ascending/descending)
- **Pagination**: shows 10 items at a time with a "Show more" button
- **Subdirectory rows**: directories expand/collapse in-place to show their posts

## Directory Structure

The path argument maps directly to a blog subdirectory in your content repo:

```
blog/
  my-series/
    chapter-1.md
    chapter-2.md
    arc-2/
      chapter-3.md
      chapter-4.md
```

```markdown
::chapters(blog/my-series)
```

This renders a table with:
- Direct posts (`chapter-1`, `chapter-2`) as standard rows
- `arc-2` as a collapsed directory row (click to expand)
- Its posts listed beneath when expanded

## Chapter Ordering

Rows are sorted by the `chapter` frontmatter field first, then by `date`. Set `chapter: N` in frontmatter to control order explicitly:

```yaml
---
title: "Chapter 3: The Crossing"
date: 2026-04-01
chapter: 3
series: my-series
---
```

## Example

```markdown
## Story Index

::chapters(/blog/raging-sun-silent-moon)
```

<panel type="note">
`::chapters()` reads from your site's built metadata. Run `npm run build` after adding new posts so the table reflects the latest content.
</panel>

## Interaction

| Action | Behavior |
|---|---|
| Click a row | Navigate to the blog post |
| Click a column header | Sort table by that column |
| Click a directory row | Expand or collapse its posts |
| "Show more" button | Load the next 10 items |
