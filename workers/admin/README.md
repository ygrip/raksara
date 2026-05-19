# Raksara Admin Worker

Secure bridge for the optional Raksara admin UI.

Local smoke test:

```bash
cd workers/admin
ADMIN_MOCK_MODE=true RAKSARA_SITE_ORIGIN=http://localhost:5173 npm run dev
```

Then open the site admin page and set the Worker URL to:

```txt
http://localhost:8787
```

Mock mode intentionally does not call GitHub. It validates the payload and returns a realistic pull-request response so the static admin UI can be tested without secrets.

Route surface:

- `POST /auth/github/start`
- `GET /auth/github/callback`
- `GET /api/me`
- `GET /api/prs`
- `POST /api/content/create-pr`

There is no public status endpoint. The static admin page uses build-time `raksara.yml` metadata for worker location and then all Worker calls require the admin challenge gate.

Create-PR payloads are multi-file by design. A normal post writes one markdown file; gallery and asset-heavy entries can add multiple `content/assets/**` files in the same pull request:

```json
{
  "type": "gallery",
  "title": "Cat Sketches",
  "slug": "cat-sketches",
  "markdown": "---\ntitle: Cat Sketches\n---\n\n![First sketch](/content/assets/images/cat-sketches-1.webp)\n",
  "assets": [
    {
      "path": "content/assets/images/cat-sketches-1.webp",
      "contentBase64": "...",
      "mediaType": "image/webp",
      "caption": "First sketch"
    }
  ]
}
```

The Worker normalizes this into ordered file operations before mock or real PR creation.

Guardrails:

- All Worker responses emit `X-Robots-Tag: noindex, nofollow, noarchive`.
- CORS only allows configured Raksara origins and local dev origins.
- Only the explicit route/method allowlist above is accepted.
- Admin challenge validation is required before auth, read, and write routes.
- GitHub session and repository author whitelist validation are required for read/write routes.
- Writes require `application/json` and a valid `X-CSRF-Token` from `/api/me`.
- Requests are rate-limited per IP/path in-memory.
- Request bodies are capped by `ADMIN_MAX_BODY_BYTES`.
- PR creation is capped by file count, per-file bytes, and total file bytes.
- Asset paths must stay under `content/assets/**` and use allowed extensions from `admin.security.allowedAssetExtensions`.
- Real GitHub write mode requires OAuth/session, repository whitelist access, and a GitHub token with content and pull-request permissions.

Production notes:

- Keep GitHub tokens only in Worker secrets.
- Do not commit a real admin challenge phrase. Store only a SHA-256 value in `admin.security.apiKeySha256`, or provide `ADMIN_API_KEY_SHA256` as a Worker secret/env override.
- Do not deploy with `ADMIN_MOCK_MODE=true`.
- GitHub OAuth/session enforcement is available for login, `/api/me`, and PR listing.
- Protected endpoints re-read `raksara.yml` from the repository and enforce `admin.allowedAuthors`.
- Real content PR creation creates one branch, writes all normalized file operations in one commit, and opens one pull request.
- Future PR preview should be best-effort: fetch PR metadata/files, render a branch preview when possible, fall back to "No preview available", and always show the GitHub PR link.
- Required secrets for real OAuth mode:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_TOKEN` with permission to read repository contents, create branches/commits, and open pull requests
  - `SESSION_SECRET`

Useful non-secret vars:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_DEFAULT_BRANCH`
- `CONTENT_ROOT`
- `RAKSARA_SITE_ORIGIN`
- `ADMIN_READ_RATE_LIMIT_PER_MINUTE`
- `ADMIN_WRITE_RATE_LIMIT_PER_MINUTE`
- `ADMIN_MAX_BODY_BYTES`
- `ADMIN_API_KEY_SHA256`
- `ADMIN_TURNSTILE_SECRET`
- `ADMIN_COOKIE_SECURE` (`false` only for local HTTP OAuth debugging)

Local Turnstile:

- The SvelteKit admin page uses Cloudflare's pass-test site key on `localhost`, `127.0.0.1`, and `::1`.
- The Worker dev server defaults `ADMIN_TURNSTILE_SECRET` to Cloudflare's matching pass-test secret.
- The Worker dev server also sets `ADMIN_TRUST_TURNSTILE_TEST_TOKEN=true`, which accepts Cloudflare's dummy `XXXX.DUMMY.TOKEN.XXXX` token only from localhost origins.
- Production must set a real `PUBLIC_TURNSTILE_SITE_KEY` for the public host and a matching real `ADMIN_TURNSTILE_SECRET` in Worker secrets.
