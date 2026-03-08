# Raksara Content Guide

How to create and manage content for your Raksara site.

---

## 1. Create a New Blog Post

Create a `.md` file inside `content/blog/`. The filename becomes the URL slug.

**File:** `content/blog/my-new-post.md`

```yaml
---
title: "Your Post Title"
date: 2026-03-08
tags:
  - javascript
  - webdev
category: engineering
summary: "A short one-liner that shows in card previews."
cover: /assets/images/my-cover.png
---

Your markdown content starts here.

## Subheading

Regular paragraphs, **bold**, *italic*, [links](https://example.com).

Code blocks with syntax highlighting:

```python
print("hello world")
```
```

### Fields Reference

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Display title of the post |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `tags` | No | List of tags (lowercase, hyphenated) |
| `category` | No | Single category string |
| `summary` | No | Short description for cards. Auto-generated from body if omitted |
| `cover` | No | Cover image path (relative to site root) |

### URL

The post will be available at:

```
/#/blog/post/my-new-post
```

---

## 2. Upload and Use Images

### Where to Put Images

Place images in the `content/assets/images/` directory:

```
content/
  assets/
    images/
      my-photo.jpg
      screenshot.png
      project-banner.svg
```

### Using Images in Markdown

Reference images in any markdown file:

```markdown
![Alt text](/content/assets/images/my-photo.jpg)
```

Images in blog posts and articles are **clickable** — they open in a full-screen lightbox.

### Adding to the Gallery

To add an image to the Gallery page, create a `.md` file in `content/gallery/`:

**File:** `content/gallery/my-photo.md`

```yaml
---
title: "Photo Title"
date: 2026-03-08
tags:
  - travel
  - nature
image: "/content/assets/images/my-photo.jpg"
caption: "A short description of the image."
---
```

You can also use external image URLs:

```yaml
image: "https://images.unsplash.com/photo-example?w=800&q=80"
```

### Profile Image

Edit `content/pages/profile.md` and set the `avatar` and `cover` fields:

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

Create a `.md` file inside `content/thoughts/`. Keep it short — these are quick ideas, not essays.

**File:** `content/thoughts/my-random-idea.md`

```yaml
---
title: "A Catchy Title"
date: 2026-03-08
tags:
  - engineering
  - hot-take
---

Your thought goes here. One or two paragraphs max.
Keep it punchy and memorable.
```

### Fields Reference

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Short title shown below the thought |
| `date` | Yes | Date (`YYYY-MM-DD`) |
| `tags` | No | List of tags |

### URL

All thoughts appear on a single page:

```
/#/thoughts
```

---

## 4. Available Categories

Categories group your content into broad topics. Use one category per post.

| Category | Posts | Description |
|---|---|---|
| `engineering` | 5 | Software engineering, coding practices, architecture |
| `devops` | 1 | Docker, CI/CD, infrastructure, deployment |
| `tools` | 3 | Developer tools, utilities, monitoring |
| `framework` | 1 | Frameworks and libraries |

### Adding a New Category

There is no separate config — categories are created automatically. Just use a new `category` value in your frontmatter:

```yaml
category: design
```

After rebuilding, the new category will appear on the Categories page.

---

## 5. Available Tags

Tags are more granular than categories. You can use multiple tags per post.

**Currently used tags:** `api`, `rest`, `backend`, `go`, `cli`, `devtools`, `docker`, `devops`, `containers`, `git`, `workflow`, `collaboration`, `automation`, `testing`, `java`, `javascript`, `nodejs`, `async`, `coding`, `python`, `monitoring`, `ai`, `engineering`, `philosophy`, `docs`, `teams`, `productivity`, `humor`, `open-source`, `community`, `hot-take`, `debugging`, `coffee`, `conference`, `speaking`, `travel`, `nature`, `homelab`, `hardware`, `vibes`, `workspace`, `setup`, `proxy`, `networking`, `static-site`, `github-pages`

Like categories, new tags are created automatically when used.

---

## 6. Building After Changes

After creating or editing content, rebuild the metadata:

```bash
npm run build
```

This scans all content, regenerates metadata indexes, and copies everything to the `web/` directory.

For local preview:

```bash
npm run dev
```

---

## Quick Reference

| I want to... | Create file in... | Template |
|---|---|---|
| Write a blog post | `content/blog/slug.md` | See Section 1 |
| Add a gallery image | `content/gallery/slug.md` | See Section 2 |
| Share a thought | `content/thoughts/slug.md` | See Section 3 |
| Add a portfolio project | `content/portfolio/slug.md` | See README.md |
| Edit my profile | `content/pages/profile.md` | See Section 2 |
| Add a static page | `content/pages/slug.md` | Frontmatter + markdown |
