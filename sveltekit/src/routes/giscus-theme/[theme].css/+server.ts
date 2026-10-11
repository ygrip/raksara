import { error } from '@sveltejs/kit';
import { loadConfig } from '$lib/metadata';
import { themeTokens } from '$lib/theme';
import type { RequestHandler } from './$types';

export const prerender = true;
export const trailingSlash = 'never';
export const entries = () => [{ theme: 'dark' }, { theme: 'light' }];

// Public Giscus custom themes work inside the iframe; parent CSS cannot.
export const GET: RequestHandler = async ({ params, fetch }) => {
  if (!['dark', 'light'].includes(params.theme)) error(404, 'Unknown comments theme');
  const dark = params.theme === 'dark';
  const tokens = themeTokens(await loadConfig(fetch), params.theme);
  const background = dark ? '#1b1814' : '#fffdf9';
  const foreground = dark ? '#f4eee4' : '#29251f';
  const muted = dark ? '#cbc2b4' : '#5d554b';
  const css = `
@import url('https://giscus.app/themes/${dark ? 'dark_dimmed' : 'light'}.css');
@font-face { font-family: 'Raksara Jakarta'; src: url('../fonts/plus-jakarta-sans-latin-wght-normal.woff2') format('woff2'); font-weight: 200 800; font-display: swap; }
main {
  color-scheme: ${dark ? 'dark' : 'light'};
  --heritage-accent: ${tokens['--accent']};
  --heritage-ink: color-mix(in oklab, var(--heritage-accent) ${dark ? '55%, #fff' : '40%, #000'});
  --heritage-line: color-mix(in oklab, var(--heritage-accent) 40%, ${background});
  --color-fg-default: ${foreground}; --color-fg-muted: ${muted}; --color-fg-subtle: ${muted};
  --color-canvas-default: ${background}; --color-canvas-overlay: ${background};
  --color-canvas-inset: ${dark ? '#100e0b' : '#f4efe7'}; --color-canvas-subtle: ${dark ? '#26211b' : '#f4efe7'};
  --color-border-default: var(--heritage-line); --color-border-muted: var(--heritage-line);
  --color-accent-fg: var(--heritage-ink); --color-accent-emphasis: var(--heritage-ink);
  --color-accent-subtle: color-mix(in oklab, var(--heritage-accent) 12%, ${background});
  --color-accent-muted: var(--heritage-line);
  --color-social-reaction-bg-hover: var(--color-accent-subtle);
  --color-social-reaction-bg-reacted-hover: color-mix(in oklab, var(--heritage-accent) 20%, ${background});
  --color-social-reaction-border: var(--heritage-line);
  --color-btn-text: ${foreground}; --color-btn-bg: ${background};
  --color-btn-border: var(--heritage-line); --color-btn-hover-border: var(--heritage-ink);
  --color-btn-hover-bg: var(--color-accent-subtle); --color-btn-selected-bg: var(--color-accent-subtle);
  --color-btn-primary-text: ${foreground};
  --color-btn-primary-bg: color-mix(in oklab, var(--heritage-accent) 24%, ${background}); --color-btn-primary-border: var(--heritage-line);
  --color-btn-primary-hover-bg: color-mix(in oklab, var(--heritage-accent) 34%, ${background}); --color-btn-primary-hover-border: var(--heritage-ink);
  --color-btn-primary-selected-bg: var(--color-btn-primary-hover-bg);
  --color-btn-primary-disabled-bg: var(--color-canvas-subtle); --color-btn-primary-disabled-text: ${muted};
  --color-btn-primary-disabled-border: var(--heritage-line);
  --color-segmented-control-bg: var(--color-canvas-subtle);
  --color-segmented-control-button-bg: ${background}; --color-segmented-control-button-selected-border: var(--heritage-ink);
}
body { background: transparent; }
body, button, input, textarea, select { font-family: 'Raksara Jakarta', 'Plus Jakarta Sans', sans-serif; }
main { font-size: 16px; line-height: 1.65; }
/* Giscus Tailwind scopes utilities to #__next. Match that specificity so
   rounded-md / color utility classes cannot defeat the custom theme. */
#__next main .gsc-comment, #__next main .gsc-header, #__next main form.gsc-comment-box { border-radius: 18px; }
#__next main form.gsc-comment-box { overflow: hidden; box-shadow: 0 8px 24px -18px var(--heritage-ink); }
#__next main .gsc-comment-box .gsc-comment-box-tabs { border-radius: 18px 18px 0 0; padding: 8px; background: var(--color-canvas-subtle); }
#__next main .gsc-comment-box-tabs button { border: 1px solid transparent; margin-bottom: 8px; border-radius: 999px; min-height: 44px; }
#__next main .gsc-comment-box-tabs button.color-bg-canvas { border-color: var(--heritage-line); background: var(--color-canvas-default); }
#__next main .gsc-comment-box .gsc-comment-box-main { padding: 12px; }
#__next main .gsc-comment-box .gsc-comment-box-textarea { border-radius: 12px 12px 0 0; font-size: 16px; color: var(--color-fg-default); background: var(--color-canvas-inset); opacity: 1; }
#__next main .gsc-comment-box-textarea::placeholder { color: var(--color-fg-muted); opacity: 1; }
#__next main .gsc-comment-box .gsc-comment-box-textarea-extras { border-radius: 0 0 12px 12px; background: var(--color-canvas-inset); }
#__next main .gsc-comment-box .gsc-comment-box-bottom { padding: 0 12px 16px; }
/* Only comment actions use large pills. Reaction chips (26px) and the emoji
   picker (32px) must retain their vendor geometry and popover positioning. */
#__next main .gsc-comment-box .gsc-comment-box-buttons .btn { border-radius: 999px; min-height: 44px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; font-family: 'Raksara Jakarta', sans-serif; }
#__next main .gsc-direct-reaction-button { align-items: center; gap: 2px; }
#__next main .gsc-comment-box .gsc-comment-box-buttons .btn-primary { color: var(--color-btn-primary-text); background: linear-gradient(180deg, var(--color-btn-primary-hover-bg), var(--color-btn-primary-bg)); border: 1px solid var(--color-btn-primary-border); box-shadow: inset 0 1px 0 ${dark ? 'rgb(255 255 255 / .14)' : '#fff'}, 0 6px 16px -12px var(--heritage-ink); }
#__next main .gsc-comment-box-buttons .btn-primary:hover { filter: brightness(${dark ? '1.08' : '.9'}); text-decoration: none; }
@media (max-width: 480px) { #__next main .gsc-comment-box-buttons { width: 100%; } #__next main .gsc-comment-box-buttons .btn { width: 100%; margin: 0; } }
#__next main a { text-underline-offset: .2em; }
#__next main a:hover { text-decoration-thickness: 2px; }
#__next main :is(a, button, input, textarea, select):focus-visible { outline: 2px solid var(--heritage-ink); outline-offset: 3px; }
#__next main .gsc-comment-box, #__next main .gsc-comment { background: var(--color-canvas-default); border-color: var(--heritage-line); }
`;
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
};
