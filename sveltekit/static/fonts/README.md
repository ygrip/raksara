# Heritage Glass fonts

Self-hosted Latin variable WOFF2 files from Fontsource (`@fontsource-variable/*`
5.3.0). No runtime dependency or font CDN.

- Cormorant Garamond (display): `cormorant-garamond-latin-wght-normal.woff2`
  (37,640 bytes), weight 300–700.
- Plus Jakarta Sans (body/UI, designed by Tokotype, Jakarta):
  `plus-jakarta-sans-latin-wght-normal.woff2` (27,348 bytes), weight 200–800.

Both faces have `font-display: swap` and are preloaded in `src/app.html` so
their requests can begin without waiting for the compiled stylesheet. The
original Cormorant italic file remains in `static/fonts` as an optional
asset, but is deliberately not registered or fetched by the theme. Rare
italics are synthesized from the regular face, saving ~39 KiB on the home
page. A `config.font` override in `raksara.yml` still replaces the body face
at runtime.

SIL OFL 1.1 licenses accompany these files.
