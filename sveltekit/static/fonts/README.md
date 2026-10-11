# Heritage Glass editorial fonts

Self-hosted Latin, normal variable WOFF2 assets from pinned Fontsource npm
tarballs (5.3.0). No application dependency or runtime CDN was added.

- Newsreader: `files/newsreader-latin-standard-normal.woff2`, 132,000 bytes;
  weight 200–800 and optical size 6–72. SHA256
  `6e4f2958c3a7c4a80acde4e5a679abe7e01bc1e30b92be3c7a8b696ef401d101`.
- Inter: `files/inter-latin-wght-normal.woff2`, 48,256 bytes; weight 100–900.
  SHA256 `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`.

Separate SIL OFL licenses accompany the files. Loaded by
`src/routes/heritage-glass.css` without preloads (`font-display: swap`).
Unsupported glyphs use system fallbacks. No italic face is downloaded; the
hero subtitle uses the browser's synthesized oblique.
