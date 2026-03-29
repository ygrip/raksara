import hljs from 'highlight.js/lib/core';

// Expose core as window.hljs so app.js can call loadScriptOnce() and
// then access it the same way it does when loading the CDN bundle.
globalThis.hljs = hljs;
