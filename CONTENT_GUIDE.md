# Raksara Content Guide

How to create and manage content for your Raksara site.

Content lives in a **separate repository** from the Raksara engine. Your content
repo is private; the engine repo is public and forkable.

---

## Content Repository Structure

Your content repo should have this structure at its root:

```
your-content-repo/
  blog/           # Blog posts (.md)
  portfolio/      # Project descriptions (.md)
  gallery/        # Gallery image entries (.md)
  thoughts/       # Short-form shower thoughts (.md)
  pages/          # Static pages (profile.md, about.md)
  assets/
    images/       # Images referenced in your content
```

Use `content-template/` in the main Raksara repo as a starting point.

---

## 1. Create a New Blog Post

Create a `.md` file inside `blog/` in your content repo. The filename becomes the URL slug.

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

### Fields

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Display title of the post |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `tags` | No | List of tags (lowercase, hyphenated) |
| `category` | No | Single category string |
| `summary` | No | Short description for cards. Auto-generated from body if omitted |

### URL

```
/#/blog/post/my-new-post
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
---
```

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
