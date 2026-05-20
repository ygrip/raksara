import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		// Injected at build time — used by metadata.ts to bust browser HTTP cache
		// for metadata JSON files after each new deployment.
		__BUILD_TS__: JSON.stringify(Date.now().toString(36)),
	},
});
