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

Global sidebar navigation remains configurable through the existing `nav` block:

```yaml
nav:
  - label: Home
    href: /
  - label: Profile
    href: /profile/
  - label: Blog
    href: /blog/
  - label: Portfolio
    href: /portfolio/
  - label: Documentation
    href: /documentation/
  - label: About
    href: /about/
```

## Generated homepage section

After normal metadata generation, Raksara reads `seo.sitelinks` and inserts a standard homepage `links` section with the stable identifier:

```text
primary-sitelinks
```

The links are rendered as ordinary visible anchors in the prerendered homepage HTML. They do not depend on client-side JavaScript and remain usable by readers, crawlers, and assistive technology.

The generator requires:

- between 2 and 10 links;
- a unique label for every link;
- a unique internal destination for every link;
- a concise description;
- a destination on the configured `site_url` origin;
- a destination present in the prerender route manifest.

Invalid links fail the build rather than publishing a prominent link to a missing page.

## Structured data

The homepage `WebSite` schema uses:

- `seo.site_name` as its preferred `name`;
- `seo.alternate_names` as `alternateName`;
- `seo.author_path` as the public URL of the `Person` entity;
- a relationship from the website to the author entity.

Raksara does not add the deprecated sitelinks search box `SearchAction`. Google removed that search-result feature globally in November 2024.

## Validation

The production build checks that:

- every configured candidate appears as a visible homepage anchor;
- the anchor label and destination match the configuration;
- the homepage contains `WebSite` JSON-LD;
- the schema uses the configured site name;
- all configured alternate names are present.

These checks improve the site's eligibility signals, but they cannot guarantee that Google will display sitelinks for a particular query.
