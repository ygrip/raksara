---
title: "Agentic Browsing"
description: "Configure llms.txt generation and a WebMCP site-search tool from raksara.yml."
summary: "Expose curated site context and structured search capabilities to compatible AI agents."
status: completed
---

# Agentic Browsing

Raksara can generate an LLM-readable site guide and expose the existing site search as a read-only WebMCP tool. Both features are configured in the content repository through `raksara.yml`.

## Configuration

```yaml
agentic:
  enabled: true
  llms:
    enabled: true
    title: Example Site
    summary: A concise explanation of the site and its primary content.
    details:
      - Additional context that helps an agent interpret the site.
    sections:
      - title: Start Here
        links:
          - label: About
            href: /about/
            description: Information about the author and site purpose.
          - label: Documentation
            href: /documentation/
            description: Site guides and reference material.
      - title: Optional
        links:
          - label: Archive
            href: /archive/
            description: Secondary material that may be skipped for shorter context.
  webmcp:
    enabled: true
    origin_trial_token: ""
    search:
      enabled: true
      name: search_example_site
      description: Search the published articles, projects, and pages on this website.
      max_results: 10
```

## Generated llms.txt

When enabled, the metadata build writes `/llms.txt` into the static site root. Relative links are converted to absolute URLs using `site_url`.

The generator requires a site title, a concise summary, at least one section, and at least one valid link per section. In strict builds, invalid configuration fails the build. Disabling the feature removes a stale generated file.

## WebMCP search

When `document.modelContext` is available, Raksara registers a search tool backed by the generated MiniSearch index. It accepts a query and an optional result limit, then returns matching titles, content sections, categories, scores, and absolute URLs.

The tool is read-only and does not submit or modify content.

WebMCP is experimental and may require a Chrome origin-trial token registered for the production origin. When the token is empty, expired, obsolete, or the API is unavailable, ordinary site search continues to work without WebMCP.

## Verification

After deployment:

1. open `/llms.txt` and confirm the generated Markdown;
2. run Lighthouse Agentic Browsing in a compatible Chrome version;
3. confirm the registered search tool appears when the origin trial is active;
4. confirm the WebMCP schema audit passes.

Form coverage can remain not applicable when the site has no form intended to be exposed as an agent tool.
