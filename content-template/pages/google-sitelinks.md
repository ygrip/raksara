---
title: "Google Sitelink Candidates"
description: "Configure site identity, primary navigation, and homepage sitelink candidates from raksara.yml."
summary: "Raksara can turn curated content configuration into visible internal links and stronger WebSite entity markup."
status: completed
---

# Google Sitelink Candidates

Google chooses sitelinks automatically. A site cannot declare that a specific set of links must appear under a search result. Raksara therefore focuses on the signals site owners can control:

- a stable and crawlable homepage;
- a concise and consistent site name;
- logical global navigation;
- visible links to important pages;
- compact, descriptive anchor text;
- valid internal targets;
- `WebSite` structured data with optional alternate names.

## Configuration

Configure site identity and candidate links in `raksara.yml`:

```yaml
seo:
  site_name: Example Site
  alternate_names:
    - Example
    - Example by Author Name
  author_path: /profile/
  sitelinks:
    enabled: true
    title: Explore Example Site
    description: Important sections and resources published on the site.
    links:
      - label: Profile
        href: /profile/
        description: Background and public profiles of the author.
      - label: Blog
        href: /blog/
        description: Technical articles and practical notes.
      - label: Portfolio
        href: /portfolio/
        description: Projects, source code, and implementation details.
      - label: Documentation
        href: /documentation/
        description: Guides and supported content components.
```

Global sidebar navigation remains configurable through the existing `nav` block. Tags and Categories can remain in that navigation as content-discovery destinations.

## Generated homepage section

After metadata generation, Raksara reads `seo.sitelinks` and inserts a standard homepage links section named `primary-sitelinks`.

The links are rendered as ordinary visible anchors in prerendered HTML. The generator requires unique labels and destinations, concise descriptions, same-origin targets, and routes present in the prerender manifest.

## Structured data

The homepage `WebSite` schema uses `seo.site_name` as its preferred name, `seo.alternate_names` as alternate names, and `seo.author_path` as the public URL of the author entity.

Raksara does not add the retired sitelinks search-box `SearchAction`.

## Validation

The production build checks that configured candidates appear as visible homepage anchors and that homepage `WebSite` JSON-LD contains the configured site identity.

These checks improve eligibility signals but cannot guarantee that Google will display sitelinks for a particular query.
