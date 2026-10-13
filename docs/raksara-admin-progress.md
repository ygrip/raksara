# Raksara Admin Implementation Progress

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

## Existing Implementation Findings

- Framework: SvelteKit 2 / Svelte 5 application under `sveltekit/`.
- Package manager: npm with root and SvelteKit `package-lock.json` files.
- Static hosting adapter: `@sveltejs/adapter-static`; routes use `prerender = true` and trailing slashes.
- Content root: `content/`, usually a local symlink to `../raksara-content`; CI checks out the content repo into `content/`.
- Asset root: content assets are copied to `sveltekit/static/content/`; generated responsive variants live under `content/.raksara-responsive`.
- Config file: optional `content/raksara.yml`, built into `metadata/config.json`.
- Content rendering: `sveltekit/src/lib/markdown.ts` renders Markdown in the browser and hydrates custom components after render.
- Existing taxonomy: tags/categories are derived from frontmatter into `metadata/tags.json` and `metadata/categories.json`; there are no taxonomy YAML files today.
- Existing workflows: `.github/workflows/deploy.yml` builds metadata, SvelteKit static output, and deploys GitHub Pages.
- Worker/admin code: no existing Worker and no existing `/admin` route before this implementation.
- Risks: the admin plan must use `content/` and `content/assets/**`, not `static/assets/**`; custom content types are section-based (`blog`, `portfolio`, `gallery`, `thoughts`, `pages`) with `novel`/`poem` modeled as blog `type` values.

## Refined Plan

- Adjusted paths: admin frontend lives under `sveltekit/src/routes/admin`; admin helpers live under `sveltekit/src/lib/admin`; Worker can later live under `workers/admin`.
- Adjusted config contract: admin config is read from the existing `content/raksara.yml -> metadata/config.json` pipeline. Missing or invalid admin config disables admin silently.
- Adjusted content types: v1 should support `blog`, `portfolio`, `gallery`, `thoughts`, and `pages`; future chapter/novel helpers should use existing blog directory metadata.
- Adjusted taxonomy: tags/categories remain free-text frontmatter fields. The metadata build derives tag/category pages after PR merge, so the admin will not create or update taxonomy files.
- Adjusted custom components: component snippets must match `markdown.ts`: `::component`, `::chapters`, `::toc`, `::file`, `<panel>`, `<container>`, `<chip>`, `<grid>`, `<rk-progress>`, fenced `chart`, fenced `mermaid`, `<thought>`, video-player links, and sortable Markdown tables.
- Adjusted PR write contract: every content action produces a single pull request with multiple file operations. The markdown file is one operation; uploaded images/assets and any generated metadata sidecars are additional operations committed to the same branch.
- Adjusted future PR preview: admin PR detail should fetch PR metadata and changed files, try to generate a local preview from the branch/file contents, show "No preview available" on failure, and always include the GitHub PR link.

## Discovery

- [x] Inspect existing project structure
- [x] Identify package manager
- [x] Identify static hosting setup
- [x] Identify content directory
- [x] Identify asset directory
- [x] Identify config loader
- [x] Identify content rendering pipeline
- [x] Identify taxonomy model
- [x] Identify deploy workflows

## Implementation

- [x] Phase 1: Failsafe config foundation
- [x] Phase 2: Worker skeleton
- [x] Phase 3: GitHub OAuth and session
- [x] Phase 4: Server-side author whitelist
- [x] Phase 5: Admin dashboard and PR list
- [x] Phase 6: New content form and templates
- [x] Phase 7: Create GitHub pull request with multi-file operations
- [x] Phase 8: Tags and categories free text
- [x] Phase 9: Assets
- [x] Phase 10: Custom components and preview
- [ ] Phase 11: Previous/next selection
- [ ] Phase 12: Deployment

## Current Notes

- Added a static `/admin` route that never contacts the Worker during build.
- Added a safe admin config resolver. The public site remains unaffected when admin config is missing, disabled, or malformed.
- Added a first custom component registry for the future editor toolbar and preview placeholders.
- Added custom component toolbar to the body editor: grouped insert buttons (directive / HTML block / code / enhancement) that inject snippets at cursor position.
- Added Write/Preview tab toggle on the body editor with a lightweight markdown renderer (headings, bold, italic, inline code, fenced code blocks, images, links, directive placeholders) — no external library needed.
- Security hardening: restricted `?worker=` query-param to localhost or the configured worker URL only; added `Secure` flag to the challenge cookie on non-localhost; added CSRF check to the logout endpoint (client sends token, worker validates); added `X-Frame-Options: DENY` and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` to Worker response headers.
- Added `workers/admin` with dependency-free local mock mode for the private admin route allowlist.
- Added admin page Worker smoke-test controls. Mock mode validates the create-PR payload and returns a realistic PR response without contacting GitHub.
- Added Worker GitHub OAuth start/callback, signed session cookies, logout, authenticated `/api/me`, and authenticated GitHub PR listing.
- Added repository-side admin whitelist enforcement from `raksara.yml` for protected endpoints.
- Added the admin new-content form with content type selection, frontmatter inputs, markdown body, deterministic image asset paths, file-to-base64 asset operations, and payload preview.
- Split the admin workspace into tabs. The default tab is content creation; pull requests are fetched lazily only when the PR tab is opened.
- OAuth start/callback/logout flows now redirect back to `/admin` with success or error query parameters so the UI can show friendly feedback instead of raw Worker JSON.
- Removed the public Worker status endpoint. Worker status is determined from build-time admin config; Worker API routes now require the admin challenge gate.
- Added admin challenge gating, POST-only GitHub auth start, strict route/method allowlists, CSRF validation for writes, generic API errors, and config-driven payload/asset limits.
- Updated the create-PR contract so mock and real mode normalize markdown plus uploaded assets into one ordered file-operation list.
- Added real GitHub PR creation: branch from default branch, create blobs for each file operation, create one tree/commit, update the branch ref, and open one pull request.
- Exposed only the safe `admin.auth.requireTurnstile` flag in public metadata so the static admin UI can validate GitHub SSO prerequisites without leaking secrets.
- Updated GitHub sign-in forms to rely on the Cloudflare-injected `cf-turnstile-response` field and block submission with a friendly message when Turnstile is required but unavailable.
- Continued the create-post form with manual slug editing, duplicate-slug blocking, editable asset alt/caption metadata, and draft reset after successful PR creation.

## Decisions

- Keep public routes and metadata generation independent from the Worker.
- Treat admin as disabled unless `admin.enabled === true`, `workerUrl` is present, and at least one valid `allowedAuthors` entry exists.
- Keep tags/categories as free-text metadata only. Do not add taxonomy files or taxonomy update endpoints unless the content model changes later.
- Keep `/admin` out of crawl surfaces: page-level `noindex,nofollow`, `X-Robots-Tag` from Worker responses, and robots.txt `Disallow`.
- Protect free-tier Worker usage with CORS allow-listing, per-IP/path in-memory rate limits, JSON-only writes, request body limits, no-store responses, OAuth/session checks, and repository-side author whitelist checks.
- Do not commit a real admin challenge phrase. Public metadata sanitizes admin config and the Worker reads private security settings directly from `raksara.yml` or env overrides.
- Create one PR per editor submission, but never assume one file per PR. Gallery submissions can include one markdown file plus several `content/assets/**` image files; future preview/build helpers can add sidecar files through the same operation list.
- Client-side image uploads should be compressed/resized before sending to the Worker. The Worker still enforces file count, per-file byte, and total byte limits as the final guardrail.
- Turnstile is required for production GitHub SSO when `admin.auth.requireTurnstile` is true. The static admin page needs `PUBLIC_TURNSTILE_SITE_KEY`; the Worker needs `ADMIN_TURNSTILE_SECRET`.
- Localhost admin uses Cloudflare Turnstile pass-test keys by default. Production must use a real site key and matching Worker secret for the deployed domain.
- Worker local dev trusts Cloudflare's dummy Turnstile token only when `ADMIN_TRUST_TURNSTILE_TEST_TOKEN=true` and the request origin is localhost.

## Issues / Blockers

- GitHub OAuth and PR creation require a Cloudflare Worker plus GitHub OAuth app/secrets, so they are not part of the static route foundation.
- Exact live preview for charts/mermaid/custom components is browser-side and should reuse `markdown.ts`; Worker-side compilation is intentionally deferred.
- Real GitHub PR creation now exists, but still needs an end-to-end run with real Worker secrets before production deploy.
- PR preview is planned after real PR creation. Preview should be best-effort and must never block access to the GitHub PR link.
- Cloudflare Workers in-memory rate limits are best-effort per isolate. Before real write mode, add durable rate limiting if usage grows or abuse appears.
- Client-side asset compression/resizing is still pending; current uploads are validated, previewed, and sent as multi-file PR payloads.

## Verification Log

- [x] `npm run check:sveltekit` — passed with 0 errors and 0 warnings.
- [x] `npm run build` — passed and generated `sveltekit/build/admin/index.html`.
- [x] `cd workers/admin && npm run smoke` — passed against local Worker mock mode with admin challenge, CSRF token, markdown file, and asset file in one PR payload.
- [x] `node --check workers/admin/src/index.js` — passed.
- [x] `node --check workers/admin/scripts/dev-server.mjs` — passed.
- [x] `node --check workers/admin/scripts/smoke-test.mjs` — passed.
- [x] `curl http://localhost:8787/api/status` — returned `404` after removing the public status endpoint.
- [x] `curl http://localhost:8787/auth/github/start` — returned `405`; auth start is POST-only.
- [x] `curl http://localhost:8787/api/me` without challenge — returned `403`.
- [x] `curl http://localhost:8787/api/me` with invalid challenge — returned `403`.
- [x] `curl -X POST http://localhost:8787/api/content/create-pr ...` without CSRF — returned `403`.
- [x] Public `metadata/config.json` — admin security/auth challenge fields are omitted from generated metadata.
- [x] `curl -D - http://localhost:8788/auth/github/start` — non-mock missing-secret flow redirected to `/admin` with `auth_error`.
- [x] `curl -D - http://localhost:8788/auth/github/callback?state=bad&code=bad` — invalid callback redirected to `/admin` with `auth_error`.
- [x] `curl -D - http://localhost:8787/auth/logout` — logout redirected to `/admin` with `logout=1` and cleared session cookie.
- [x] `curl -X POST http://localhost:8787/api/content/create-pr ...` — returned mock branch, file path, and PR URL.
- [x] `curl -X POST http://localhost:8787/api/content/create-pr ...` — rejected markdown that referenced a slug-scoped uploaded asset missing from the PR payload.
- [x] `curl http://localhost:5174/admin/` — confirmed static admin page content is served locally.
- [x] `sveltekit/build/robots.txt` — includes `Disallow: /admin` and `Disallow: /admin/`.
- [x] Worker headers — include `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store`, and security headers.
- [x] Worker write guardrail — non-JSON `POST /api/content/create-pr` returns `JSON content type is required.`
- [x] `npm run check:sveltekit` — passed after Turnstile auth form and create-post form updates.
- [x] `WORKER_URL=http://localhost:8791 npm run smoke` — passed against a local mock Worker after the latest create-post form updates.
