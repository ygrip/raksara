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
  - title: "Chapter 2: The Journey"
    link: "#/blog/post/novel/chapter-2"
previous_page:
  - title: "Prologue"
    link: "#/blog/post/novel/prologue"
---
```

| Field | Required | Description |
|---|---|---|
| `title` | No | Custom link label. Defaults to "Next Page" / "Previous Page" |
| `link` | Yes | Hash URL to the target page |

### Fields

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Display title of the post |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `tags` | No | List of tags (lowercase, hyphenated) |
| `category` | No | Single category string |
| `summary` | No | Short description for cards. Auto-generated from body if omitted |
| `next_page` | No | Link to the next post in a series |
| `previous_page` | No | Link to the previous post in a series |

### URL

```
/#/blog/post/my-new-post
/#/blog/post/folder/nested-post
```

---

## 2. Upload and Use Images

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

## 3. Create a New Shower Thought

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

## 4. Create a Portfolio Project

Create a `.md` file in `portfolio/`:

**File:** `portfolio/my-project.md`

```yaml
---
title: "Project Name"
type: project
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

---

## 5. Categories and Tags

Categories and tags are created automatically from your frontmatter. There is no
separate config file.

```yaml
category: engineering    # creates/increments the "engineering" category
tags:
  - python               # creates/increments the "python" tag
  - automation
```

---

## 6. Publishing Changes

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

## 7. Site Configuration (`raksara.yml`)

Create a `raksara.yml` file at the **root** of your content repository to
customize your site.

**File:** `raksara.yml`

```yaml
color: purple
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

---

## 8. Sharing

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
| Add a gallery image | `gallery/slug.md` |
| Share a thought | `thoughts/slug.md` |
| Add a portfolio project | `portfolio/slug.md` |
| Edit my profile | `pages/profile.md` |
| Add a static page | `pages/slug.md` |
| Upload an image | `assets/images/filename.ext` |
| Change accent color | `raksara.yml` → `color: blue` |
