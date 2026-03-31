---
title: "Grid Component"
summary: "Multi-column content grid that wraps any block elements — images, panels, chips, and more"
icon: "⊞"
status: "available"
previous_page:
  title: "Progress Bar Component"
  link: "#/doc/progress"
next_page:
  title: "Chart Component"
  link: "#/doc/chart"
---

# Grid Component

The `<grid>` component wraps any block-level content into an evenly-spaced CSS grid with 2, 3, or 4 columns. Content naturally wraps to the next row. Collapses gracefully on smaller screens.

## Syntax

```html
<grid column=3>
Any block content here — images, panels, text, chips, etc.
</grid>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `column` | `3` | Number of columns: `2`, `3`, or `4` |

## Responsive behavior

| Viewport | `column=2` | `column=3` | `column=4` |
|---|---|---|---|
| Desktop (>768px) | 2 cols | 3 cols | 4 cols |
| Tablet (≤768px) | 2 cols | 2 cols | 2 cols |
| Mobile (≤480px) | 1 col | 1 col | 1 col |

## Examples

### Image gallery grid

```html
<grid column=3>
![Photo 1](/content/assets/images/photo-1.jpg)
![Photo 2](/content/assets/images/photo-2.jpg)
![Photo 3](/content/assets/images/photo-3.jpg)
![Photo 4](/content/assets/images/photo-4.jpg)
![Photo 5](/content/assets/images/photo-5.jpg)
![Photo 6](/content/assets/images/photo-6.jpg)
</grid>
```

### Two-column text layout

```html
<grid column=2>
**Column A**

First paragraph of content in the left column.

**Column B**

Second paragraph of content in the right column.
</grid>
```

### Mixing panels in a grid

```html
<grid column=3>
<panel type="info">Point one</panel>
<panel type="success">Point two</panel>
<panel type="warning">Point three</panel>
</grid>
```

## Notes

- Each direct child block element (paragraph, image, panel, etc.) occupies one grid cell
- There is no explicit "cell" wrapper syntax — the grid auto-places items
- Max-width is constrained by the article body container
