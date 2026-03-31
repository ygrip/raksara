# Raksara Content Guide

How to create and manage content for your Raksara site.

Content lives in a **separate repository** from the Raksara engine. Your content
repo is private; the engine repo is public and forkable.

---

## Content Repository Structure

Your content repo should have this structure at its root:

```
your-content-repo/
  blog/           # Blog posts (.md) — supports nested directories
    post.md
    series-name/
      part-1.md
      part-2.md
  portfolio/      # Project descriptions (.md)
  gallery/        # Gallery image entries (.md)
  thoughts/       # Short-form shower thoughts (.md)
  pages/          # Static pages (profile.md, about.md)
  assets/
    images/       # Images referenced in your content
  raksara.yml     # Site configuration (accent color, etc.)
```

Use `content-template/` in the main Raksara repo as a starting point.

---

## 1. Create a New Blog Post

Create a `.md` file inside `blog/` in your content repo. The full path within
`blog/` becomes the URL slug.

**File:** `blog/my-new-post.md`

```yaml
---
title: "Your Post Title"
date: 2026-03-08
status: ongoing
tags:
  - javascript
  - webdev
category: engineering
summary: "A short one-liner that shows in card previews."
---

Your markdown content starts here.
```

### Nested Directories

Blog posts support nested directories. Folders are displayed as navigable
sections on the blog page with humanized names (e.g. `my-series` becomes
"My Series"). Each folder gets its own listing page with breadcrumb navigation.

```
blog/
  standalone-post.md            -> /#/blog/post/standalone-post
  novel/
    chapter-1.md                -> /#/blog/post/novel/chapter-1
    chapter-2.md                -> /#/blog/post/novel/chapter-2
    bonus/
      deleted-scenes.md         -> /#/blog/post/novel/bonus/deleted-scenes
```

Directory listing pages:

```
/#/blog                         -> root (shows folders + root-level posts)
/#/blog/dir/novel               -> shows novel/ contents
/#/blog/dir/novel/bonus         -> shows novel/bonus/ contents
```

### Next / Previous Page Navigation

Add `next_page` and/or `previous_page` to frontmatter to link posts in a series.
A navigation bar appears at the bottom of the post.

```yaml
---
title: "Chapter 1"
date: 2026-03-08
next_page:
  title: "Chapter 2: The Journey"
  link: "/blog/post/novel/chapter-2"
previous_page:
  title: "Prologue"
  link: "/blog/post/novel/prologue"
---
```

| Field | Required | Description |
|---|---|---|
| `title` | No | Custom link label. Defaults to "Next Page" / "Previous Page" |
| `link` | Yes | Hash URL to the target page |

### Content Types

Raksara supports different content types, each with an optimized layout.
Set the `type` field in frontmatter to activate a specific layout.

#### Default (standard blog)

Standard blog layout. This is the default when `type` is omitted.

```yaml
---
title: "My Post"
date: 2026-03-08
type: default
---
```

#### Poem

Centered, serif typography optimized for poetry. Each paragraph becomes a
stanza. Single line breaks within a paragraph are preserved.

```yaml
---
title: "Saturn's Rings"
date: 2026-03-10
type: poem
cover: https://images.unsplash.com/photo-example
tags:
  - poetry
---

First stanza line one
First stanza line two

Second stanza line one
Second stanza line two
```

No HTML needed — just write plain text. Blank lines separate stanzas.
The `cover` field adds a hero image above the poem.

#### Novel

Book-style layout for long-form narrative. Paragraphs are indented,
serif font, optimized for immersive reading.

```yaml
---
title: "The Desert Wolf"
date: 2026-03-10
type: novel
status: ongoing
series: desert-wolf
chapter: 1
readingMode: true
---

The desert wind howled across the dunes...
```

| Type Field | Description |
|---|---|
| `series` | Groups chapters under a named series |
| `chapter` | Chapter number (shown above the title) |
| `readingMode` | Auto-enable reading mode when opened |

#### Comic

Image-first comic layout with two reading modes:
- `scroll` mode: vertical long-strip reading
- `swipe` mode: one panel/page at a time with previous/next controls

Reader mode choice is persisted in-session.

```yaml
---
title: "Episode 01"
date: 2026-03-10
type: comic
images:
  - src: content/assets/images/comic/ep01-01.jpg
    caption: "Opening"
  - src: content/assets/images/comic/ep01-02.jpg
---
```

### Reading Mode

Any post can include a reading mode toggle (appears in the toolbar).
Reading mode hides the sidebar, centers content, and uses larger type.

Set `readingMode: true` in frontmatter to auto-enable it when the post opens.
Readers can also toggle it manually.

### Fields

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Display title of the post |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `type` | No | Content type: `default`, `poem`, `novel`, or `comic` |
| `tags` | No | List of tags (lowercase, hyphenated) |
| `category` | No | Single category string |
| `summary` | No | Short description for cards. Auto-generated from body if omitted |
| `status` | No | Workflow state: `draft`, `ongoing`, or `completed` |
| `cover` | No | Cover image URL (used by poem type) |
| `series` | No | Series identifier (used by novel type) |
| `chapter` | No | Chapter number (used by novel type) |
| `images` | No | Array of image objects/paths (used by comic type) |
| `readingMode` | No | Auto-enable reading mode (`true` / `false`) |
| `next_page` | No | Link to the next post in a series |
| `previous_page` | No | Link to the previous post in a series |

### Internal Links

You can link to other content pages using relative paths. Raksara
automatically resolves these to the correct hash-based URLs.

```markdown
[Read my other post](/blog/poem/saturns-ring)
[About page](/pages/about)
[Portfolio project](/portfolio/raksara)
```

#### Anchor Links

All headings in articles automatically get an ID attribute. You can link to
specific sections:

```markdown
[Jump to results](/blog/reviving-ideas-with-cursor#the-result)
[See skills section](#skills)
```

The ID is generated by lowercasing the heading text, replacing spaces with
hyphens, and stripping special characters.

### URL

```
/#/blog/post/my-new-post
/#/blog/post/folder/nested-post
```

---

## 2. File Attachments (Downloadable Files)

Embed a downloadable file card anywhere in your markdown using the `::file[path]` syntax.
The card shows a file-type icon, the filename, the file extension badge, and the file
size (fetched automatically). Clicking the card downloads the file.

### Syntax

```markdown
::file[content/assets/files/report.pdf]
::file[content/assets/files/data.xlsx "Q4 Financial Report"]
::file[https://example.com/whitepaper.pdf "External Whitepaper"]
```

- **First argument** — path to the file (relative to the web root or a full URL).
- **Optional quoted label** — overrides the displayed filename.

### Where to Put Files

Store downloadable files in `assets/files/` in your content repo:

```
assets/
  files/
    report.pdf
    data.xlsx
    slides.pptx
```

Reference them from any post:

```markdown
::file[content/assets/files/report.pdf]
```

### Supported File Types

| Category | Extensions |
|---|---|
| PDF | `.pdf` |
| Word | `.doc` `.docx` `.odt` `.rtf` |
| Excel | `.xls` `.xlsx` `.ods` `.csv` |
| PowerPoint | `.ppt` `.pptx` `.odp` |
| Archive | `.zip` `.rar` `.gz` `.tar` `.7z` `.bz2` |
| Image | `.jpg` `.jpeg` `.png` `.gif` `.svg` `.webp` `.bmp` `.avif` |
| Video | `.mp4` `.mov` `.avi` `.mkv` `.webm` |
| Audio | `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a` |
| Code | `.js` `.ts` `.py` `.go` `.rs` `.sh` `.json` `.sql` … |
| Text | `.md` `.txt` `.log` |

Any other extension renders as a generic file card.

---

## 3. Custom Markdown Components

### Table of Contents

Use `::toc(...)` to inject a table of contents generated from headings in the same document.

```markdown
::toc(type=bullet, level=3)
```

Options:
- `type=bullet` or `type=number`
- `level=1..6` (maximum heading depth included)

The TOC is expanded by default and can be collapsed/expanded by readers.

### Chapters Table

Use `::chapters(...)` to inject a chapter list from a blog directory:

```markdown
::chapters(/blog/novel/my-series)
```

This renders a sortable chapter-like table linked to each post in the matched directory path.

---

## 4. Code Blocks

Standard fenced code blocks are supported:

````markdown
```js
console.log("hello");
```
````

For long code blocks, Raksara shows:
- a fade indicator at the bottom
- an expand button
- a collapse button once expanded

Default for long blocks is collapsed.

---

## 3. Upload and Use Images

### Where to Put Images

Place images in `assets/images/` in your content repo:

```
assets/
  images/
    my-photo.jpg
    screenshot.png
```

### Using Images in Markdown

Reference images in any markdown file:

```markdown
![Alt text](/content/assets/images/my-photo.jpg)
```

Images in blog posts and articles are clickable and open in a lightbox.

### Embedding Videos

To embed a video with a YouTube-style player preview, add a link with
`class="video-player"` wrapping a thumbnail image:

```html
<a class="video-player" href="https://www.youtube.com/watch?v=VIDEO_ID" target="_blank">
  <img src="https://img.youtube.com/vi/VIDEO_ID/0.jpg" alt="Video title here" />
</a>
```

This renders as a styled video preview with a play button, gradient overlay,
and title (from the `alt` text). Clicking opens the video URL in a new tab.

You can use any thumbnail URL — YouTube auto-generates thumbnails at:

| URL | Size |
|---|---|
| `https://img.youtube.com/vi/VIDEO_ID/0.jpg` | 480×360 (default) |
| `https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg` | 480×360 |
| `https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg` | 1280×720 |

### Adding to the Gallery

Create a `.md` file in `gallery/`:

**File:** `gallery/my-photo.md`

```yaml
---
title: "Photo Title"
date: 2026-03-08
tags:
  - travel
image: "/content/assets/images/my-photo.jpg"
caption: "A short description of the image."
---

Optional longer description here. If the description exceeds roughly two lines
it will be collapsed with a "Show more" toggle, similar to YouTube descriptions.
```

External image URLs also work:

```yaml
image: "https://images.unsplash.com/photo-example?w=800&q=80"
```

#### Multi-Image Gallery

To include multiple images in a single gallery entry, use the `images` array
instead of the single `image` field. Each entry has a `src` and optional
`caption`.

```yaml
---
title: "Weekend Trip"
date: 2026-03-08
tags:
  - travel
images:
  - src: "/content/assets/images/trip-1.jpg"
    caption: "Morning coffee by the lake"
  - src: "/content/assets/images/trip-2.jpg"
    caption: "Sunset from the hill"
  - src: "/content/assets/images/trip-3.jpg"
    caption: "Night market vibes"
---
```

Multi-image entries appear with a **stacked card** visual and image count badge
on the gallery list and homepage. Clicking opens a **carousel lightbox** with
prev/next navigation, dot indicators, and keyboard arrow key support.

| Field | Description |
|---|---|
| `image` | Single image path or URL (original format, still supported) |
| `images` | Array of `{ src, caption }` objects for multi-image entries |

Both formats are supported. If `images` is present it takes priority over
`image`.

### Profile Image

Edit `pages/profile.md` and set the `avatar` and `cover` fields:

```yaml
---
title: "Your Name"
role: "Your Role"
avatar: "/content/assets/images/avatar.jpg"
cover: "/content/assets/images/cover.jpg"
github: "https://github.com/yourusername"
linkedin: "https://linkedin.com/in/yourusername"
email: "you@example.com"
metadata:
  - label: "Location"
    value: "Your City"
  - label: "Focus"
    value: "Web Development"
  - label: "Blog"
    value: "My Blog"
    url: "https://blog.example.com"
---
```

### Dynamic Metadata Chips

The `metadata` array renders as interactive chips below the profile hero.
Each item supports:

| Field | Required | Description |
|---|---|---|
| `label` | Yes | Left-side label shown in lighter text |
| `value` | Yes | Main display text |
| `url` | No | Makes the chip a clickable link |

Chips without a `url` are static labels. Chips with a `url` gain a hover
effect and open in a new tab.

---

## 4. Create a New Shower Thought

Create a `.md` file in `thoughts/`:

**File:** `thoughts/my-random-idea.md`

```yaml
---
title: "A Catchy Title"
date: 2026-03-08
tags:
  - engineering
---

Your thought goes here. One or two paragraphs max.
```

### URL

All thoughts appear on: `/#/thoughts`

---

## 5. Create a Portfolio Project

Create a `.md` file in `portfolio/`:

**File:** `portfolio/my-project.md`

```yaml
---
title: "Project Name"
type: project
status: completed
tags:
  - python
  - automation
category: tools
github: "https://github.com/you/project"
demo: "https://project.dev"
summary: "What the project does"
---

Detailed project description in markdown...
```

Valid `status` values for blog/novel and portfolio content are:

- `draft`
- `ongoing`
- `completed`

When provided, Raksara shows a status chip on cards and detail pages.

---

## 6. Categories and Tags

Categories and tags are created automatically from your frontmatter. There is no
separate config file.

```yaml
category: engineering    # creates/increments the "engineering" category
tags:
  - python               # creates/increments the "python" tag
  - automation
```

---

## 7. Publishing Changes

### Automatic rebuild

Push your content changes to your content repo's `main` branch. The
`notify-rebuild.yml` workflow fires a `repository_dispatch` event to your
Raksara fork, which triggers a full rebuild and deploy.

### Manual rebuild

Edit `sync.yml` in your Raksara fork and bump the version:

```yaml
version: 2
```

Push the change to `main`.

### Local preview

```bash
# In your Raksara fork directory
git clone git@github.com:you/your-content.git content
npm install
npm run build
npm run dev
```

---

## 8. Site Configuration (`raksara.yml`)

Create a `raksara.yml` file at the **root** of your content repository to
customize your site.

**File:** `raksara.yml`

```yaml
color: purple
hero_title: Raksara
hero_subtitle: A place where ideas, knowledge, and engineering thoughts are recorded.
```

### Accent Color

The `color` field sets the accent color used across the entire site — buttons,
gradients, hero backgrounds, tags, navigation highlights, and more.

| Value | Description |
|---|---|
| `purple` | Indigo-violet (default) |
| `blue` | Sky blue / cyan |
| `red` | Red / rose / pink |
| `yellow` | Amber / gold |
| `green` | Emerald / teal |
| `orange` | Orange / warm amber |

If `raksara.yml` is missing or the `color` field is omitted, the site defaults
to `purple`.

### Hero Banner

| Field | Default | Description |
|---|---|---|
| `hero_title` | `Raksara` | Large display text on the homepage hero |
| `hero_subtitle` | (built-in default) | Description text below the title |
| `author` | _(empty)_ | Site author name, shown in meta tags and content footers |
| `logo` | _(none)_ | Path to a logo image (e.g. `assets/images/logo.svg`). Replaces the text logo in the sidebar |
| `og_image` | _(none)_ | Default social share image path (e.g. `assets/images/og.png`). Used as the Open Graph / Twitter Card fallback image on pages that don't have a cover image |

### SEO & Open Graph

Raksara automatically generates dynamic `<meta>` tags for every page —
title, description, Open Graph (for social cards on LinkedIn, Slack, etc.),
and Twitter/X Card.

- **Blog posts** — use the post `title`, `summary`, `cover`, `tags`, and `author`.
- **Portfolio items** — same as blog posts.
- **Profile page** — uses the author name and hero cover as the OG image.
- **Directory / list pages** — use a contextual title (e.g. "Blog", "Gallery", "Tag: golang").
- **Fallback image** — set `og_image` in `raksara.yml` to provide a default social thumbnail
  for pages without a cover photo.

**Example `raksara.yml` with full SEO config:**

```yaml
color: green
hero_title: Yunaz Gilang
hero_subtitle: Engineering thoughts, creative work, and random ideas.
author: Yunaz Gilang
og_image: assets/images/og-card.png
adsense: google.com, <your-pub>, DIRECT, <your-key>
```

### Google AdSense (`ads.txt` + meta tag)

You can configure AdSense directly in `raksara.yml`:

```yaml
adsense: google.com, <your-pub>, DIRECT, <your-key>
```

When this field is set, build output will include:

- `ads.txt` at the site root (with that exact line)
- `<meta name="google-adsense-account" content="<your-pub>"/>` in generated page heads

If `adsense` is missing, `ads.txt` is not generated.

### Giscus Comments (GitHub Discussions)

Raksara supports optional comments using [Giscus](https://giscus.app/) on detail pages.

- **Default behavior**: enabled for blog post detail (`/blog/post/*`) and portfolio detail (`/portfolio/*`)
- **Lazy loading**: the Giscus script is only injected when the comments area is near the viewport
- **Stable mapping**: uses `data-mapping="specific"` with a path term per page

Add this block in `raksara.yml`:

```yaml
comments:
  enabled: true
  repo: ygrip/raksara
  repo_id: R_kgDORhluFg
  category: Q&A
  category_id: DIC_kwDORhluFs4C5dRd
  strict: true
  reactions_enabled: true
  emit_metadata: false
  input_position: top
  lang: en
  pages:
    - blog
    - portfolio
```

Field notes:

| Field | Required | Description |
|---|---|---|
| `enabled` | Yes | Global on/off switch for comments |
| `repo` | Yes | GitHub repo in `owner/name` format |
| `repo_id` | Yes | Giscus repository ID |
| `category` | Yes | Discussion category name |
| `category_id` | Yes | Discussion category ID |
| `strict` | No | `true` for strict term matching |
| `reactions_enabled` | No | Enable GitHub reactions in comment thread |
| `emit_metadata` | No | Emit metadata events from Giscus iframe |
| `input_position` | No | `top` or `bottom` |
| `lang` | No | UI language (for example `en`) |
| `pages` | No | Defaults to `blog` and `portfolio` when omitted |

#### Per-Content Override (`comments_enabled`)

You can override comment visibility from frontmatter for a single post/project:

```yaml
comments_enabled: false
```

Rules:

- `comments_enabled: false` → comments are hidden for that page
- `comments_enabled: true` → force-enable comments for that page (if global `enabled: true`)
- not set → fallback to default page rules (`pages` list)

---

## 9. Sharing

Every page with content has a **Share** button — blog posts, blog directories,
gallery, thoughts, portfolio listing, and portfolio detail pages.

The share button copies the page title and URL in the format:

```
Page Title : https://yoursite.github.io/raksara/#/blog/post/my-post
```

On mobile devices that support the Web Share API, it opens the native share
sheet instead.

---

## Quick Reference

| I want to... | Create file in... |
|---|---|
| Write a blog post | `blog/slug.md` |
| Write a poem | `blog/poem/slug.md` (with `type: poem`) |
| Write a novel chapter | `blog/novel/slug.md` (with `type: novel`) |
| Add a gallery image | `gallery/slug.md` |
| Add multi-image gallery | `gallery/slug.md` (with `images:` array) |
| Embed a video | `<a class="video-player" href="...">` in markdown |
| Share a thought | `thoughts/slug.md` |
| Add a portfolio project | `portfolio/slug.md` |
| Edit my profile | `pages/profile.md` |
| Add a static page | `pages/slug.md` |
| Upload an image | `assets/images/filename.ext` |
| Change accent color | `raksara.yml` → `color: blue` |
| Disable comments on one post | Frontmatter → `comments_enabled: false` |
| Link to another post | `[text](/blog/slug)` |
| Link to a heading | `[text](/blog/slug#heading-id)` |

---

## 10. Custom Components

### Thought Bubble — `<thought>`

Renders a styled quote bubble, suitable for dialogue or attributed quotes.
Consecutive `<thought>` blocks from different authors create a chat-like layout.

```html
<thought author="Yunaz" logo="/content/assets/images/logo.png" align="right">
Any **markdown** or text can go here.
</thought>
```

| Attribute | Default | Description |
|---|---|---|
| `author` | — | Name shown in the attribution line |
| `logo` | — | Optional image URL for the author avatar |
| `align` | `right` | `right` (attribution bottom-right, quote top-left) or `left` (flipped) |

### Progress Bar — `<rk-progress>`

Animated progress bar counting from 0 to the target value on scroll-into-view.

```html
<!-- Simple -->
<rk-progress total=100 current=72 color="green"></rk-progress>

<!-- With milestones -->
<rk-progress total=100 current=100 color="purple">
  <bar at=50 icon="flag">Halfway there</bar>
  <bar at=100 icon="fire">Done!</bar>
</rk-progress>
```

| Attribute | Default | Description |
|---|---|---|
| `total` | `100` | Maximum integer value |
| `current` | `0` | Current integer value (clamped to `total`) |
| `color` | accent | `red` `purple` `green` `blue` `white` `yellow` `orange` or any CSS color |
| `border` | — | Optional border color for the bar wrapper |

`<bar>` attributes:

| Attribute | Default | Description |
|---|---|---|
| `at` | — | Position on the scale (same units as `total`) |
| `icon` | — | Named icon: `fire` `star` `check` `flag` `bolt` `heart` `trophy` `target` `pin` `lock` `rocket` `gem` `crown` `shield` `warning`, or any emoji |

Hovering a `<bar>` shows its tooltip text.

### Grid — `<grid>`

A CSS grid wrapper that evenly distributes any block content into columns.

```html
<grid column=3>
![Image 1](/content/assets/images/a.jpg)
![Image 2](/content/assets/images/b.jpg)
![Image 3](/content/assets/images/c.jpg)
</grid>
```

| Attribute | Default | Description |
|---|---|---|
| `column` | `3` | Number of columns: `2`, `3`, or `4` |

Content collapses to 2 columns on tablet and 1 column on mobile automatically.

### Chart — ` ```chart ` block

Renders an interactive Chart.js chart. Use a fenced code block with the `chart` language tag.

````markdown
```chart
{
  type: 'bar',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{
      label: 'Sales',
      data: [120, 190, 80, 170],
      backgroundColor: ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd']
    }]
  },
  options: {
    plugins: { title: { display: true, text: 'Monthly Sales' } }
  }
}
```
````

The config is a native **Chart.js** configuration object. All chart types are supported: `bar`, `line`, `area`, `pie`, `doughnut`, `radar`, `polarArea`, `bubble`, `scatter`.

**Loading data from a JSON file:**

Set `data` to a relative path to a JSON file containing a valid Chart.js `data` object (`{ labels, datasets }`):

````markdown
```chart
{
  type: 'line',
  data: 'content/assets/files/chart-data.json',
  options: { responsive: true }
}
```
````

If the file is not found or the config is invalid, the chart is silently hidden. Chart.js is loaded on-demand — only when a page actually contains a chart block.
