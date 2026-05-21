import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

function loadLocalAdminConfig(contentRoot) {
	const normalizedContentRoot = String(contentRoot || 'content').replace(/^\/+|\/+$/g, '');
	const candidates = [
		path.resolve(repoRoot, normalizedContentRoot, 'raksara.yml'),
		path.resolve(repoRoot, 'raksara.yml')
	];
	for (const candidate of candidates) {
		try {
			return { sourcePath: candidate, text: readFileSync(candidate, 'utf8') };
		} catch {
			// Try next candidate.
		}
	}
	return null;
}

const contentRoot = process.env.CONTENT_ROOT ?? '';
const inlineAdminConfig = process.env.ADMIN_LOCAL_CONFIG || '';
const fileAdminConfig = inlineAdminConfig ? null : loadLocalAdminConfig(contentRoot);

const env = {
	GITHUB_OWNER: process.env.GITHUB_OWNER || 'yunaz',
	GITHUB_REPO: process.env.GITHUB_REPO || 'raksara',
	GITHUB_DEFAULT_BRANCH: process.env.GITHUB_DEFAULT_BRANCH || 'main',
	CONTENT_ROOT: contentRoot,
	RAKSARA_SITE_ORIGIN: process.env.RAKSARA_SITE_ORIGIN || 'http://localhost:5174,http://localhost:5173',
	ADMIN_MOCK_MODE: process.env.ADMIN_MOCK_MODE || 'true',
	SESSION_SECRET: process.env.SESSION_SECRET,
	GITHUB_TOKEN: process.env.GITHUB_TOKEN,
	GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
	ADMIN_COOKIE_SECURE: process.env.ADMIN_COOKIE_SECURE,
	ADMIN_API_KEY_SHA256: process.env.ADMIN_API_KEY_SHA256,
	ADMIN_TURNSTILE_SECRET: process.env.ADMIN_TURNSTILE_SECRET || '1x0000000000000000000000000000000AA',
	ADMIN_TRUST_TURNSTILE_TEST_TOKEN: process.env.ADMIN_TRUST_TURNSTILE_TEST_TOKEN || 'true',
	ADMIN_READ_RATE_LIMIT_PER_MINUTE: process.env.ADMIN_READ_RATE_LIMIT_PER_MINUTE,
	ADMIN_WRITE_RATE_LIMIT_PER_MINUTE: process.env.ADMIN_WRITE_RATE_LIMIT_PER_MINUTE,
	ADMIN_MAX_BODY_BYTES: process.env.ADMIN_MAX_BODY_BYTES,
	ADMIN_LOCAL_CONFIG: inlineAdminConfig || fileAdminConfig?.text
};

const port = Number(process.env.PORT || 8787);

function toRequest(req, body) {
	const url = `http://localhost:${port}${req.url || '/'}`;
	return new Request(url, {
		method: req.method,
		headers: req.headers,
		body: body.length && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined
	});
}

const server = http.createServer(async (req, res) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const request = toRequest(req, Buffer.concat(chunks));
	const response = await worker.fetch(request, env);
	const headers = Object.fromEntries(response.headers.entries());
	const getSetCookie = response.headers.getSetCookie;
	if (typeof getSetCookie === 'function') {
		const setCookies = getSetCookie.call(response.headers);
		if (Array.isArray(setCookies) && setCookies.length) {
			headers['set-cookie'] = setCookies;
		}
	}
	res.writeHead(response.status, headers);
	res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, () => {
	console.log(`Raksara admin worker listening on http://localhost:${port}`);
	console.log(`Mode: ${env.ADMIN_MOCK_MODE === 'true' ? 'mock' : 'github-oauth'}`);
	if (inlineAdminConfig) {
		console.log('Admin config source: ADMIN_LOCAL_CONFIG env');
	} else if (fileAdminConfig?.sourcePath) {
		console.log(`Admin config source: ${fileAdminConfig.sourcePath}`);
	} else {
		console.log('Admin config source: GitHub repository');
	}
});
