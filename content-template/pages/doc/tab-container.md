---
title: "Tab Container"
summary: "Responsive tabs in four positions, with per-tab icons, accent overrides, and nested Markdown components"
icon: "▤"
status: "available"
---

# Tab Container

Use `<TabContainer>` to divide a longer page into switchable sections. Only the selected tab's content is shown. Each tab can contain ordinary Markdown, code, tables, images, and other Raksara components.

## Basic example

````html
<TabContainer mode="top" label="Project details">
  <Tab id="overview" title="Overview" icon="book">
    ### What this project does

    **Markdown** works inside every tab.

    <panel type="info">So do custom components.</panel>
  </Tab>
  <Tab id="examples" title="Examples" icon="code" color="#e29a34">
    ```js
    console.log('Hello from Raksara');
    ```
  </Tab>
  <Tab title="Resources" icon="link">
    [Read the documentation](/doc)
  </Tab>
</TabContainer>
````

## Positioning

Set `mode` to one of these four values:

| Mode | Tab placement |
|---|---|
| `top` (default) | Tabs along the top of the content |
| `bottom` | Tabs below the content |
| `left` | Vertical tabs on the left |
| `right` | Vertical tabs on the right |

On narrow screens, left and right become scrollable horizontal tabs so the content keeps its width.

## Container attributes

| Attribute | Default | Description |
|---|---|---|
| `mode` | `top` | `top`, `left`, `right`, or `bottom` |
| `label` | `Content tabs` | Accessible label announced for the tab group |
| `default` or `active` | `0` | Initially selected zero-based index, or a tab's `id` / `title` |
| `color` | `var(--accent)` | Default active indicator color for this group |

## Tab attributes

| Attribute | Default | Description |
|---|---|---|
| `title` | `Tab 1`, etc. | Label shown in the tab navigation |
| `id` | — | Optional key for selecting with the container's `default` attribute |
| `icon` | — | Built-in icon name (e.g. `book`, `code`, `check`, `star`) or emoji |
| `color` | Container color | Overrides the active underline (or vertical indicator) color for that tab |

Colors accept CSS color names, hex values, `rgb()` / `hsl()` colors, or `var(--token)`. Invalid values fall back to the site accent.

## Live example: nested components

<TabContainer mode="left" default="overview" label="Raksara tab examples">
  <Tab id="overview" title="Overview" icon="book">
### A place for different content

Write normal **Markdown** and include any supported Raksara component.

<panel type="success">Tabs preserve the site's theme.</panel>
  </Tab>
  <Tab id="nested" title="Nested" icon="grid" color="#db9137">
<grid cols="2">
<panel type="info">Left panel</panel>
<panel type="warning">Right panel</panel>
</grid>
  </Tab>
  <Tab id="more" title="More tabs" icon="star">
<TabContainer mode="bottom" label="Tabs inside tabs">
  <Tab title="First" icon="check">First nested tab.</Tab>
  <Tab title="Second" icon="star" color="#3b82f6">Second nested tab.</Tab>
</TabContainer>
  </Tab>
</TabContainer>

## Interaction

Use **Tab** to enter the tab list, then arrow keys to switch tabs; **Home** and **End** jump to the first and last tab. Clicking a tab also switches its content. Focus, selected state, and visible panels stay synchronized for assistive technologies.

A group can contain another `<TabContainer>` in one of its tabs. Keep the closing `</Tab>` and `</TabContainer>` tags paired, especially when nesting them.
