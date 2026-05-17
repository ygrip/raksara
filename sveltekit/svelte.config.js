import adapter from '@sveltejs/adapter-static';
import { relative, sep } from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: false,
		}),
		paths: {
			base: '',
		},
		prerender: {
			// Warn (not error) when metadata JSON files are missing at build time.
			// In CI the build pipeline copies metadata/ before npm run build runs.
			handleHttpError: 'warn',
			// Dynamic slug routes are not prerendered — served via fallback SPA on GitHub Pages.
			handleUnseenRoutes: 'warn',
			// Crawl all linked pages for prerendering
			crawl: true,
		},
	}
};

export default config;
