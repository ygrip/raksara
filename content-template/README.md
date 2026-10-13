# Raksara Content Template

This is the expected directory structure for a Raksara content repository.

```
your-content-repo/
  blog/           # Blog posts (.md)
  portfolio/      # Project descriptions (.md)
  gallery/        # Gallery image entries (.md)
  thoughts/       # Short-form shower thoughts (.md)
  pages/          # Static pages like profile.md, about.md
  assets/
    images/       # Images referenced in your content
  raksara.yml     # Site configuration (accent color, hero, SEO, optional comments)
```

Copy this structure into your own private content repository. See the main
[Raksara README](https://github.com/ygrip/raksara) and `CONTENT_GUIDE.md` for
detailed authoring instructions.

## Highlighted topic archives

Add an explicit allowlist to `raksara.yml` to prerender selected tag archives:

```yaml
taxonomy:
  highlighted_tags: [java]
topics:
  java:
    title: Java
    intro: Articles about Java engineering and tooling.
```

Names must match tags in visible posts, projects, thoughts or gallery entries exactly.
Highlighted names must be safe slugs (letters, digits, hyphens and underscores,
starting with a letter or digit); query-shell terms can include Unicode and punctuation.
Topic titles/descriptions alone do not opt a tag into indexing; an omitted allowlist
highlights nothing. Highlighted tags retain `/tag/java/`; other tags use
`/tag/?name=...`, and categories use `/category/?name=...`. These shared browser
views are noindex. See the engine README for migration and GitHub Pages redirect
limitations. Publish the configuration in the content branch used by deployment.
