---
title: "Chart Component"
summary: "Interactive Chart.js charts rendered from a fenced code block — bar, line, pie, radar, and more"
icon: "📈"
status: "available"
previous_page:
  title: "Grid Component"
  link: "#/doc/grid"
---

# Chart Component

Embed interactive charts by writing a Chart.js configuration object inside a fenced code block tagged with `chart`. Chart.js is loaded on-demand — only pages that contain a chart block download it.

## Syntax

````markdown
```chart
{
  type: 'bar',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Revenue',
      data: [120, 190, 80, 170, 240],
      backgroundColor: '#6366f1'
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Monthly Revenue' }
    }
  }
}
```
````

The block content is a native **Chart.js** configuration object. All standard Chart.js chart types are supported.

## Supported Chart Types

| `type` | Description |
|---|---|
| `bar` | Vertical bar chart |
| `line` | Line / area chart |
| `pie` | Pie chart |
| `doughnut` | Doughnut chart |
| `radar` | Radar / spider chart |
| `polarArea` | Polar area chart |
| `bubble` | Bubble chart |
| `scatter` | Scatter plot |

## Loading Data from a File

Set `data` to a relative path instead of an inline object. Raksara will fetch the file at render time.

````markdown
```chart
{
  type: 'line',
  data: 'content/assets/files/sales-data.json'
}
```
````

The JSON file must be a valid Chart.js `data` object:

```json
{
  "labels": ["Q1", "Q2", "Q3", "Q4"],
  "datasets": [
    {
      "label": "Sales",
      "data": [150, 200, 180, 260],
      "borderColor": "#6366f1",
      "fill": false
    }
  ]
}
```

Place the file in `assets/files/` in your content repo.

## Examples

### Bar chart

````markdown
```chart
{
  type: 'bar',
  data: {
    labels: ['JavaScript', 'TypeScript', 'Go', 'Rust', 'Python'],
    datasets: [{
      label: 'Familiarity',
      data: [95, 88, 60, 40, 75],
      backgroundColor: ['#6366f1','#8b5cf6','#a78bfa','#7c3aed','#4f46e5']
    }]
  }
}
```
````

### Radar chart

````markdown
```chart
{
  type: 'radar',
  data: {
    labels: ['Frontend', 'Backend', 'DevOps', 'Design', 'Writing'],
    datasets: [{
      label: 'Skills',
      data: [90, 75, 60, 50, 80],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.15)'
    }]
  }
}
```
````

### Doughnut chart

````markdown
```chart
{
  type: 'doughnut',
  data: {
    labels: ['Blog', 'Portfolio', 'Gallery', 'Thoughts'],
    datasets: [{
      data: [42, 15, 23, 20],
      backgroundColor: ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd']
    }]
  }
}
```
````

## Notes

- If the config is invalid, the data file is unreachable, or Chart.js fails to render, the chart is silently hidden — no broken element is shown
- Default options applied automatically: `responsive: true`, `animation: easeInOutQuart`, legend at top
- You can override any option in the `options` field — your values take precedence
- The chart container is scrollable horizontally on narrow viewports
