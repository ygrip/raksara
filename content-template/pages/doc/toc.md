---
title: "Table of Contents"
summary: "Auto-generated heading index with bullet or numbered list, collapsible by default"
icon: "📑"
status: "available"
next_page:
  title: "Panel Component"
  link: "#/doc/panel"
---

# Table of Contents

Use `::toc()` to inject an auto-generated table of contents built from the headings in the same document. The TOC is collapsible and can be placed anywhere in the page.

## Syntax

```markdown
::toc()
::toc(type=bullet, level=3)
::toc(number, 4)
```

## Parameters

| Parameter | Values | Default | Description |
|---|---|---|---|
| `type` | `bullet`, `number` | `bullet` | List style — bullet points or numbered outline |
| `level` | `1`–`6` | `3` | Maximum heading depth to include |

Parameters can be written in two ways:

```markdown
::toc(type=bullet, level=3)
::toc(bullet, 3)
```

Both forms are equivalent.

<panel type="info">
The TOC only includes headings that appear **after** the `::toc()` call in the document. Place it near the top to capture all headings.
</panel>

## Examples

### Bullet list, depth 3 (default)

```markdown
::toc()
```

### Numbered outline, depth 4

```markdown
::toc(type=number, level=4)
```

### Shorthand

```markdown
::toc(bullet, 2)
```

Renders a two-level bullet list.

## Behavior

- The TOC block has a **toggle button** — readers can collapse or expand it.
- Heading IDs are auto-generated from heading text (lowercase, spaces → hyphens).
- Headings with the same text get unique IDs automatically.
- The minimum heading level found in the document sets the base indentation — so if your content only uses `##` and `###`, they appear at indent level 0 and 1 respectively.
