---
title: "File Attachment"
summary: "Downloadable file cards with icon, filename, extension badge, and auto-fetched file size"
icon: "📎"
status: "available"
previous_page:
  title: "Sortable Tables"
  link: "#/doc/table"
next_page:
  title: "Video Player"
  link: "#/doc/video"
---

# File Attachment

Use `::file[path]` to embed a downloadable file card anywhere in your markdown. The card shows a styled file-type icon, the filename, an extension badge, and the file size (fetched automatically from the server).

## Syntax

```markdown
::file[content/assets/files/report.pdf]
::file[content/assets/files/data.xlsx "Q4 Financial Report"]
::file[https://example.com/whitepaper.pdf "External Whitepaper"]
```

- **First argument** — path to the file (relative to web root, or a full URL)
- **Optional quoted label** — overrides the displayed filename

## Where to Store Files

Place downloadable files in `assets/files/` inside your content repo:

```
assets/
  files/
    report.pdf
    data.xlsx
    slides.pptx
```

Reference them with the `content/` prefix:

```markdown
::file[content/assets/files/report.pdf]
```

## Supported File Types

| Category | Extensions |
|---|---|
| PDF | `.pdf` |
| Word | `.doc` `.docx` `.odt` `.rtf` |
| Excel | `.xls` `.xlsx` `.ods` `.csv` |
| PowerPoint | `.ppt` `.pptx` `.odp` |
| Archive | `.zip` `.rar` `.gz` `.tar` `.7z` `.bz2` |
| Image | `.jpg` `.jpeg` `.png` `.gif` `.svg` `.webp` `.avif` |
| Video | `.mp4` `.mov` `.avi` `.mkv` `.webm` |
| Audio | `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a` |
| Code | `.js` `.ts` `.py` `.go` `.rs` `.sh` `.json` `.sql` … |
| Text | `.md` `.txt` `.log` |

Any unrecognised extension renders as a generic **FILE** card.

## Custom Display Name

To show a user-friendly label instead of the raw filename, add a quoted string after the path:

```markdown
::file[content/assets/files/q4-2025-report.xlsx "Q4 2025 Financial Report"]
```

<panel type="info">
File size is fetched via a `HEAD` request in the browser. Files served without a `Content-Length` header will show no size. External URLs must support CORS for size detection to work.
</panel>
