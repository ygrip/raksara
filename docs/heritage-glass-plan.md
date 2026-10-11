# Raksara: Heritage Glass

**Status:** foundation scaffold, not a wholesale homepage redesign.

## Intent

Preserve Raksara's frosted panels and animated DotField. Add an intentionally restrained Indonesian craft vocabulary inspired by Kawung, Mega Mendung and botanical ukiran. This is a modern interpretation, not a historically authenticated reproduction.

- Neutral first. No hardcoded amber or gold branding.
- Paper for reading, frost for floating UI, ink for subtle borders and motifs.
- DotField remains the sole hero canvas and animated identity.
- Ornaments are optional: use sparingly, and keep text surfaces clear.
- No extra client JavaScript for ordinary ornament rendering.

## Architecture

| Layer | Path | Responsibility |
|---|---|---|
| Vector originals | sveltekit/static/heritage/*.svg | Small transparent silhouette assets |
| Design tokens | sveltekit/src/routes/heritage.css | Paper, frost, border and ornament ink variables |
| Component | sveltekit/src/lib/components/HeritageOrnament.svelte | Motif, corner and size variants |
| Initial adoption | sveltekit/src/routes/+page.svelte | One ukiran decoration inside existing hero glass |
| Theme source | sveltekit/src/routes/+layout.svelte | Existing accent and light/dark selection |

Available motifs: kawung, ukiran, mega-mendung. Corner placement: top-left, top-right, bottom-left, bottom-right. Sizes: small, medium, large. Parent must be positioned. Add the heritage-frame class only where needed.

**Color contract:** all ornament colors are derived from CSS --accent and text-neutral variables using color-mix. Changing a named accent or custom config.accent updates decorative colors without remounting. No separate heritage palette/picker.

| Scheme | Material | Accent in decorative ink |
|---|---|---|
| Light | low-opacity frost and neutral paper | 12%; remaining 88% from text secondary |
| Dark | charcoal frost and neutral surfaces | 20%; remaining 80% from text secondary |
| Reduced transparency | solid/high-opacity material | unchanged |
| Mobile <= 640 px | preserve fast hero | hero ornament hidden |

### Which JS library?

**Default: none.** Static SVG and CSS masking are sufficient for a batik/ukiran border. They work with existing SSR, browser caching and the runtime accent picker with no extra script.

- Rough.js: optional for precomputed sketched strokes, preferably build-time (P2).
- SVG.js: optional, lazy-loaded only for exploratory vector editing/animated ornaments (P3).
- Flubber: optional path interpolation if a verified, worthwhile morph experiment needs it.
- Avoid constantly animated canvas, shaders and Lottie behind DotField.

## Phases

### P0. Foundation (this PR)

- [x] Original Kawung, Mega Mendung and ukiran-inspired SVG assets.
- [x] Neutral accent-aware CSS tokens for frosted/paper materials and ornament.
- [x] Reusable Svelte ornament, first opt-in on homepage hero.
- [x] Keep DotField and original layout/filter styles.
- [ ] Browser and build validation prior to merge.

### P1. Consolidation

- [ ] Audit duplicated global blur selectors; keep only necessary frosted layers.
- [ ] Align paper/frost/ink semantics throughout components; replace duplicated hardcoded surfaces carefully.
- [ ] Check accent config: custom accent and palette-derived RGB must not disagree for hover/glow/UI.
- [ ] Create private fixture page for 7 named accents, custom color, dark/light and disabled blur.
- [ ] Screenshot 360px, 768px, 1440px; check contrast, focus rings, clipping and touch targets.
- [ ] Ensure unsupported CSS masking degrades to a clean plain frame.

### P2. Expressive identity

- [ ] Add one Kawung section marker, one Mega Mendung portfolio/feature flourish.
- [ ] Create a small set of purposeful pen-like annotations, not ambient looping animation.
- [ ] Keep blog/article/doc views calm and their reading background substantially opaque.
- [ ] Review motif choices with reliable craft references; do not invent their symbolic meanings.

### P3. Interaction experiments

- [ ] Morph a floating search pill into a panel with CSS/View Transitions and keyboard-safe fallback.
- [ ] Optional sketch-to-finished-project preview on one featured portfolio card.
- [ ] Only if needed, lazy-load SVG.js on the interactive demo, not the main bundle.
- [ ] Obey prefers-reduced-motion and reduced-transparency preferences.

## Acceptance criteria

1. DotField behavior, image morphs, theme change and existing homepage navigation remain intact.
2. Updating CSS --accent dynamically recolors ornaments and borders, without JS work.
3. Light/dark and each named palette/custom accent stay readable and distinct.
4. Decoration is aria-hidden, pointer-events none, no keyboard interference.
5. No layout shifts or horizontal overflow from frames, especially on phones.
6. Ordinary ornaments add 0 KB JS; no extra blur/render layer on DotField.
7. Compare LCP, INP, CLS and scroll smoothness against the base branch on a real mid-range phone.
8. Cultural design is deliberate and subtle, not overloaded.

## Checks

    node scripts/test-heritage.mjs
    npm run check:sveltekit
    npm run build

Static checks are a scaffold, not a substitute for full build and browser QA.
