---
title: "Container Component"
summary: "Glassmorphism flex containers with scrolling"
icon: "📦"
status: "available"
---

# Container Component

Containers are responsive, glassmorphism-styled flex wrappers. Use them to group content with visual separation and scrolling support.

## Syntax

```html
<container>
  Content goes here. Markdown, HTML, and mixed content are all supported.
</container>
```

## Usage

### Basic Container

<container>
  - Item 1
  - Item 2
  - Item 3
  - Item 4
</container>

### Container with Mixed Content

<container>
  **Bold text** and regular content mix freely.
  
  ```javascript
  console.log("Code blocks work too!");
  ```
  
  [Links](https://example.com) are fully functional.
</container>

## Layout & Scrolling

Containers have the following characteristics:

- **Display**: Flexbox with wrap enabled
- **Scrolling**: Auto-scroll on both axes if content overflows
- **Max-height**: 480px (configurable per-instance in future versions)
- **Max-width**: 100% (responsive to viewport)
- **Border**: Glassmorphism glass border (--border-glass)
- **Background**: Semi-transparent blur effect (backdrop-filter: blur 12px)
- **Gap**: 12px spacing between flex children

### Example: Multi-item Layout

<container>
  [Link 1](/blog) • [Link 2](/portfolio) • [Link 3](/gallery) • [Link 4](/thoughts) • [Link 5](/about) • [Link 6](/doc)
</container>

### Example: Long Content (Scrollable)

<container>
  Line 1: Lorem ipsum dolor sit amet
  
  Line 2: consectetur adipiscing elit
  
  Line 3: sed do eiusmod tempor
  
  Line 4: incididunt ut labore et dolore
  
  Line 5: magna aliqua. Ut enim ad
  
  Line 6: minim veniam, quis nostrud
  
  Line 7: exercitation ullamco laboris
  
  Line 8: nisi ut aliquip ex ea commodo
  
  (Scroll down to see more)
</container>

## Styling

Containers inherit the theme's glassmorphism aesthetic:
- **Dark mode**: Semi-transparent dark background with light blur
- **Light mode**: Semi-transparent light background with light blur
- **Border**: Subtle glass border that adapts to theme

## Use Cases

1. **Organize related links**
2. **Display scrollable lists or galleries**
3. **Group code snippets with explanations**
4. **Create responsive card layouts**
5. **Showcase teasers or previews**

<panel type="info">
Containers automatically wrap flex items. Items with `min-width: 0` will shrink to fit the container's width before triggering scroll.
</panel>
