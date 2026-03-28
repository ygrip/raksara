---
title: "Video Player"
summary: "Thumbnail preview with a play button overlay that opens a video URL on click"
icon: "🎬"
status: "available"
previous_page:
  title: "File Attachment"
  link: "#/doc/file"
next_page:
  title: "Chapters Table"
  link: "#/doc/chapters"
---

# Video Player

Raksara can transform a standard image-link into a styled video preview card. The card shows a thumbnail with a circular play button and an optional title. Clicking it opens the video URL in a new tab.

## Syntax

Use an anchor tag with `class="video-player"` wrapping an `<img>` tag directly in your markdown:

```html
<a class="video-player" href="https://www.youtube.com/watch?v=VIDEO_ID" target="_blank">
  <img src="https://img.youtube.com/vi/VIDEO_ID/0.jpg" alt="Video title here" />
</a>
```

- **`href`** — the video URL (YouTube, Vimeo, direct video file, etc.)
- **`src`** — thumbnail image URL
- **`alt`** — displayed as a title overlay at the bottom of the card

## YouTube Thumbnails

YouTube auto-generates thumbnails at predictable URLs:

| URL | Resolution |
|---|---|
| `https://img.youtube.com/vi/VIDEO_ID/0.jpg` | 480×360 (default) |
| `https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg` | 480×360 (high quality) |
| `https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg` | 1280×720 (max res) |

Replace `VIDEO_ID` with the 11-character ID from the YouTube URL.

**Example — full YouTube embed:**

```html
<a class="video-player" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
  <img src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="Never Gonna Give You Up" />
</a>
```

## Custom Thumbnail

You can use any image as the thumbnail — your own screenshot, a cover image, or an uploaded asset:

```html
<a class="video-player" href="https://vimeo.com/123456789" target="_blank">
  <img src="/content/assets/images/my-video-cover.jpg" alt="My Talk at Conference 2026" />
</a>
```

## Appearance

The card renders with:
- The thumbnail image filling the full card width
- A **dark gradient overlay** at the bottom
- A **circular play button** centered on the image
- The **`alt` text** as a title at the bottom (if provided)

<panel type="note">
The video player is activated after the page renders — it's a JavaScript enhancement of the raw HTML. The HTML itself degrades gracefully in environments without JavaScript by showing a plain linked image.
</panel>
