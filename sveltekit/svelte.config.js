import adapter from '@sveltejs/adapter-static';
import { relative, sep } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const prerenderManifestUrl = new URL('./static/metadata/prerender-routes.json', import.meta.url);

function loadPrerenderEntries() {
	if (!existsSync(prerenderManifestUrl)) {
		return ['*'];
	}

	try {
		const routes = JSON.parse(readFileSync(prerenderManifestUrl, 'utf-8'));
		if (Array.isArray(routes) && routes.every((route) => typeof route === 'string')) {
			return routes.length > 0 ? routes : ['/'];
		}
	} catch (error) {
		console.warn(`Failed to load prerender route manifest: ${error.message}`);
	}

	return ['*'];
}

const prerenderEntries = loadPrerenderEntries();

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
			handleUnseenRoutes: 'warn',
			// The metadata build emits the same indexable routes used by sitemap.xml.
			// GitHub Pages then serves crawler-readable HTML for those routes, while
			// non-indexable routes can still use the adapter fallback as an SPA.
			entries: prerenderEntries,
			crawl: false,
		},
	}
};

export default config;
