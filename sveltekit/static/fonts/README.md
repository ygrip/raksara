# Heritage Glass fonts

Self-hosted Latin variable WOFF2 files from the Fontsource npm packages
(`@fontsource-variable/*` 5.3.0). No runtime dependency or font CDN.

- Cormorant Garamond (display): `cormorant-garamond-latin-wght-normal.woff2`
  (37,640 bytes) and `cormorant-garamond-latin-wght-italic.woff2`
  (39,260 bytes), weight 300–700.
- Plus Jakarta Sans (body/UI, designed by Tokotype, Jakarta):
  `plus-jakarta-sans-latin-wght-normal.woff2` (27,348 bytes), weight 200–800.

SIL OFL 1.1 licenses accompany the files. Loaded by
`src/routes/heritage-glass.css` with `font-display: swap`; a `config.font`
override in `raksara.yml` still replaces the body face at runtime.
