---
title: "Chip Component"
summary: "Compact pill-shaped badges with icons and labels"
icon: "🏷️"
status: "available"
---

# Chip Component

Chips are compact, inline-stylable badges perfect for tags, status indicators, and shorthand information displays. They support optional icons and labels.

## Syntax

```html
<chip icon="check" label="Status">ready</chip>
```

### Attributes

- **`icon`** (optional): Icon name or emoji
  - Named icons: `check`, `info`, `warning`, `star`, `tag`, `link`, `user`, `code`, `arrow-right`, `external`
  - Emoji: Any emoji character (e.g., `🚀`, `✨`)
  - URLs: Supported for future extensibility
- **`label`** (optional): Bold text displayed before the main text
- **Inner text**: Main chip content (required)

## Examples

### With Icon & Label

<chip icon="check" label="Status">Ready to Deploy</chip>

<chip icon="warning" label="Alert">Requires Review</chip>

<chip icon="star" label="Featured">Recommended</chip>

### With Icon Only

<chip icon="code">TypeScript</chip>

<chip icon="link">External Link</chip>

<chip icon="user">Contributor</chip>

### With Label Only

<chip label="Type">Documentation</chip>

<chip label="Version">2.0</chip>

### With Emoji

<chip icon="🚀">Launch Ready</chip>

<chip icon="✨">New Feature</chip>

<chip icon="📦">Package</chip>

### Text Only (No Icon or Label)

<chip>Default Chip</chip>

<chip>Another One</chip>

## Styling

Chips have the following characteristics:

- **Display**: Inline-flex with centered alignment
- **Shape**: Pill-shaped (border-radius: 999px)
- **Background**: Glassmorphism glass effect
- **Icon**: 14×14 SVG, accent-colored, left-positioned
- **Label**: Bold (font-weight: 600), primary text color
- **Text**: Secondary text color, 12px font size
- **Gap**: 6px between icon, label, and text
- **Padding**: 4px vertical, 10px horizontal

## Inline Usage

Chips work inline within paragraphs:

This post is tagged with <chip icon="tag">raksara</chip>, <chip icon="tag">documentation</chip>, and <chip icon="tag">components</chip>.

The status is <chip icon="check">complete</chip> and ready for <chip icon="link">deployment</chip>.

## Use Cases

1. **Post tags and categories**: `<chip icon="tag">blog</chip> <chip icon="tag">tutorial</chip>`
2. **Status indicators**: `<chip icon="check">Active</chip>`
3. **Technology badges**: `<chip icon="code">JavaScript</chip> <chip icon="code">React</chip>`
4. **Version labels**: `<chip label="v">2.0</chip>`
5. **Quick action links**: `<chip icon="external">View Demo</chip>`
6. **Skill badges**: `<chip icon="star">Expert</chip>`

<panel type="note">
Chips automatically wrap in text. Use them liberally—they're lightweight and responsive.
</panel>

## Icon Reference

### Named Icons

| Icon | Name | Usage |
|------|------|-------|
| ✓ | `check` | Confirmation, ready |
| ℹ | `info` | Information |
| ⚠ | `warning` | Caution |
| ⭐ | `star` | Featured, important |
| # | `tag` | Categories, labels |
| 🔗 | `link` | External, related |
| 👤 | `user` | Author, contributor |
| `<>` | `code` | Language, tech |
| → | `arrow-right` | Next, forward |
| ↗ | `external` | External link |

### Emoji Support

Any emoji works! Examples:
- `🚀` Launch, rocket
- `✨` Sparkle, highlight
- `📦` Package, bundle
- `🎉` Success, celebrate
- `🔥` Hot, trending
