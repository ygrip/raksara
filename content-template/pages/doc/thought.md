---
title: "Thought Bubble Component"
summary: "Attributed quote bubbles with author logos and alignment — great for dialogue and testimonials"
icon: "💬"
status: "available"
next_page:
  title: "Progress Bar Component"
  link: "#/doc/progress"
---

# Thought Bubble Component

The `<thought>` component renders a styled quote bubble with optional author attribution and logo. Place consecutive `<thought>` blocks from different authors to create a chat-like dialogue.

## Syntax

```html
<thought author="Yunaz" logo="/content/assets/images/logo.png" align="right">
Any **markdown** or plain text can go here, including _emphasis_, `code`, and links.
</thought>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `author` | — | Name shown in the attribution line below the quote |
| `logo` | — | Path to an image (avatar) for the author |
| `align` | `right` | `right` — attribution at bottom-right, quote mark at top-left; `left` — flipped |

## Examples

### Single bubble (default right)

<thought author="Yunaz" align="right">
This is a simple thought bubble. You can use **markdown** inside it.
</thought>

### Chat-style dialogue (two authors)

<thought author="Alice" align="left">
Have you tried the new Raksara custom components yet?
</thought>

<thought author="Bob" align="right">
Yes! The progress bars and chart blocks are great for documentation pages.
</thought>

### Bubble with logo

```html
<thought author="Yunaz" logo="/content/assets/images/avatar.jpg" align="right">
Thoughts inherit the site accent color automatically.
</thought>
```

## Notes

- Content inside `<thought>` is rendered as full markdown (supports headings, lists, emphasis, code, etc.)
- `logo` is optional — omitting it shows only the author name
- `align` defaults to `right` if omitted or set to anything other than `left`
- Consecutive thoughts from different authors with opposite alignment create a natural conversation layout
