# Readynaz AdSense resubmission checklist

This is an engineering checklist, **not** a guarantee of AdSense approval. A "low value content" rejection requires an editorial review of the actual published pages as well as technical verification.

## Automated checks

- `ads.txt` is generated at the site root from `content/raksara.yml` and the built copy authorizes the configured Google publisher.
- The initial HTML for every sitemap page includes exactly one `google-adsense-account` meta tag with the `ca-pub-…` ID, without waiting for JavaScript or a user gesture.
- The optional ad provider script uses `client=ca-pub-…`, not `pub-…`.
- The provider script is only initially loaded after interaction on prerendered article/project detail pages that contain HTML. Noindex archive shells, directories, policy pages, home, and short-form creative content are excluded.
- The shared `/tag/` and `/category/` shells remain noindex and offer crawlable links to real articles, curated topics and projects.

## Verify after deployment

1. Inspect **View page source**, not just the DevTools Elements tab, on `/` and one published article. Confirm the account meta tag appears in the original response.
2. Open `https://readynaz.com/ads.txt` and confirm HTTP 200, `text/plain`, and the precise `google.com, pub-…, DIRECT, …` publisher line. Check this again after Cloudflare cache purges.
3. In Google Search Console, inspect sitemap coverage and indexing for full articles. Check that links, rendered article bodies, canonical URLs, and mobile layouts work without JavaScript.
4. Manually review every indexable article and project for genuine unique substance, up-to-date references, non-broken demos, meaningful commentary/screenshots and accurate bylines. Improve, remove or noindex pages that offer little standalone value. Do not publish filler or use arbitrary word counts.
5. Verify About, Contact, Privacy Policy and any advertising/cookie disclosures reflect the actual network integrations. **If serving ads to visitors in the EEA/UK/Switzerland, configure an appropriate Google-certified CMP** and the required consent signals before enabling personalized ad serving.
6. If Auto Ads is enabled in the AdSense dashboard, review Google's placement controls. Once the Google library has loaded on a detail page it persists during SvelteKit client-side navigation, so the loader guard alone cannot prevent later automatic placements on non-content routes. Prefer explicit manual placements in eligible articles if strict per-route placement is required.
7. Confirm there are no competing advertising tags, intrusive interstitials, accidental placements near controls, or advertising on empty/error pages. Test from a clean browser on desktop and mobile.
8. **Only after the checks above**, request a new site review in AdSense. The platform can still reject the site based on content quality, user interest or policy assessments not observable from the repository.

## Run locally

```sh
npm run test:adsense:readiness
npm run test:taxonomy:policy
npm run build
```
