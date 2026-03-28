---
title: "Sortable Tables"
summary: "Interactive columns with ascending, descending, and reset sorting"
icon: "📊"
status: "available"
---

# Sortable Tables

Raksara enhances GitHub-flavored markdown tables with interactive column sorting. No special syntax required—just use standard GFM table syntax, and sorting is automatically enabled.

## Syntax

Use standard GitHub-flavored markdown table syntax:

```markdown
| Framework | Release | Status |
|-----------|---------|--------|
| React     | 2022    | Active |
| Vue       | 2021    | Active |
| Angular   | 2023    | Beta   |
```

## Usage

### Example Table

| Name     | Category | Launch Year | Status |
|----------|----------|-------------|--------|
| Webpack  | Bundler  | 2012        | Active |
| Vite     | Bundler  | 2021        | Active |
| Rollup   | Bundler  | 2015        | Active |
| Parcel   | Bundler  | 2017        | Active |

Click any column header to sort:
- **First click**: Sort ascending (A→Z, 0→9)
- **Second click**: Sort descending (Z→A, 9→0)
- **Third click**: Reset to original order

### Numeric vs. String Sorting

Tables automatically detect column type:
- **Numeric columns**: `2023`, `42`, `3.14` sort numerically
- **String columns**: `"apple"`, `"zebra"` sort alphabetically
- **Mixed columns**: Fall back to string sorting

### Wide Tables

Tables wider than the viewport automatically enable horizontal scrolling. No special markup needed.

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |

Scroll right to see all columns →

## Tips

- **Headers are clickable only**—sorting works on `<th>` elements
- **CSS classes**: Sort indicators appear via `.sort-icon` with animated arrows
- **Active column**: Highlighted with `[aria-sort="ascending"]` or `[aria-sort="descending"]` attributes
- **Keyboard accessible**: Use Tab to focus headers, then Enter/Space to sort

## Implementation Notes

Sorting is implemented in `web/app.js` via `initSortableTables()` and is automatically initialized after every article render. No additional setup required.
