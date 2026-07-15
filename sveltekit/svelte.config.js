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
			const entries = routes.length > 0 ? routes : ['/'];
			return Array.from(new Set([...entries, '/admin']));
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
			// A failed public route must fail the build. Continuing after a 500 can
			// publish an incomplete GitHub Pages artifact without index.html.
			handleHttpError: 'fail',
			handleUnseenRoutes: 'warn',
			// The metadata build emits the routes that must have crawler-readable
			// static HTML. Non-prerendered utility routes can still use the fallback.
			entries: prerenderEntries,
			crawl: false,
		},
	}
};

export default config;
