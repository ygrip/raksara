---
title: "Panel Component"
summary: "Styled content blocks with icons and color coding"
---

# Panel Component

Panels are highlighted content blocks with built-in icons, color coding, and support for markdown inside. Use them to draw attention to important information.

## Syntax

```html
<panel type="info|note|warning|error|success">
  **Markdown content** goes here. Links, code, and formatting all work!
</panel>
```

## Types

### info
Information and general notices.

<panel type="info">
This is an **informational** panel. Use it for tips, definitions, or any neutral information.
</panel>

### note
Author's notes and additional context.

<panel type="note">
This is a **note** from the author. Add extra details, clarifications, or side comments here.
</panel>

### warning
Cautions and things to watch out for.

<panel type="warning">
This is a **warning**. Something important might break or cause issues if not done correctly.
</panel>

### error
Errors, mistakes, and things to avoid.

<panel type="error">
This is an **error** panel. Highlight critical mistakes or dangerous practices here.
</panel>

### success
Positive outcomes, achievements, and completed tasks.

<panel type="success">
This is a **success** panel. Use it for completed insights, best practices, or positive outcomes.
</panel>

## Markdown Inside Panels

Panels fully support markdown syntax:

<panel type="note">
You can use:
- **Bold text** and *italic*
- `inline code` and code blocks
- [Links](https://example.com)
- Lists and nested structures

```javascript
console.log("Code blocks too!");
```
</panel>

## Styling

Each panel type has:
- **Colored left border** (3px) matching the type theme
- **Glassmorphism background** with 12px blur effect
- **Icon** (16×16 SVG) positioned on the left
- **Content area** with flex layout for responsive text wrapping

<panel type="info">**Pro tip:** Combine panels with tables and other components for rich, structured content.</panel>

## Examples

### Use in Documentation

<panel type="warning">
**Breaking Change in v2.0**

The `renderMd()` function now requires a second parameter. Pass an empty object `{}` for default behavior.
</panel>

### Use in Blog Posts

<panel type="success">
We've successfully migrated 10,000+ posts to the new system. Performance improved by 40%.
</panel>
