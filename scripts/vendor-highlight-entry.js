import hljs from 'highlight.js/lib/core';

// Expose core as window.hljs so the SvelteKit Markdown renderer can load
// languages on demand and use the same global shape as the browser bundle.
globalThis.hljs = hljs;
