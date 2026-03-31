---
title: "Progress Bar Component"
summary: "Animated progress bars with milestone markers, icons, and tooltips"
icon: "📊"
status: "available"
previous_page:
  title: "Thought Bubble Component"
  link: "#/doc/thought"
next_page:
  title: "Grid Component"
  link: "#/doc/grid"
---

# Progress Bar Component

The `<rk-progress>` component renders an animated progress bar that counts from 0 to the target value as it scrolls into view. Add `<bar>` children to mark milestones with icons and hover tooltips.

## Syntax

```html
<!-- Simple bar -->
<rk-progress total=100 current=72 color="green"></rk-progress>

<!-- Bar with milestones -->
<rk-progress total=100 current=100 color="purple">
  <bar at=25 icon="flag">First quarter</bar>
  <bar at=50 icon="bolt">Halfway there!</bar>
  <bar at=100 icon="fire">Complete! 🎉</bar>
</rk-progress>
```

## `<rk-progress>` Attributes

| Attribute | Default | Description |
|---|---|---|
| `total` | `100` | Maximum value (integer) |
| `current` | `0` | Current value (integer, clamped to `total`) |
| `color` | accent | Named color or any CSS color value |
| `border` | — | Optional border color for the bar wrapper |

### Named Colors

`red` · `purple` · `green` · `blue` · `white` · `yellow` · `orange`

Any CSS color string (hex, `rgb()`, etc.) also works for `color` and `border`.

## `<bar>` Attributes

| Attribute | Default | Description |
|---|---|---|
| `at` | — | Position on the scale (same units as `total`) |
| `icon` | — | Named icon or any emoji |

### Named Icons

| Name | Emoji |
|---|---|
| `fire` | 🔥 |
| `star` | ⭐ |
| `check` | ✓ |
| `flag` | 🚩 |
| `bolt` | ⚡ |
| `heart` | ❤️ |
| `trophy` | 🏆 |
| `target` | 🎯 |
| `pin` | 📌 |
| `lock` | 🔒 |
| `rocket` | 🚀 |
| `gem` | 💎 |
| `crown` | 👑 |
| `shield` | 🛡️ |
| `warning` | ⚠️ |

You can also use any emoji directly: `icon="🦊"`. If no icon is given, a solid dot is shown instead.

## Examples

### Language proficiency

<rk-progress total=10 current=9 color="blue">
  <bar at=5 icon="star">Intermediate</bar>
  <bar at=10 icon="trophy">Fluent</bar>
</rk-progress>

### Project completion

<rk-progress total=100 current=65 color="purple">
  <bar at=33>Design done</bar>
  <bar at=66 icon="rocket">Development</bar>
  <bar at=100 icon="flag">Shipped</bar>
</rk-progress>

## Notes

- Animation is triggered once as the bar scrolls into view (IntersectionObserver)
- On mobile, the bar scrolls horizontally if the viewport is too narrow
- The label below shows `current / total`
