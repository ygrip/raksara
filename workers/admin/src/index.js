const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8'
};

const SUPPORTED_CONTENT_TYPES = new Set(['blog', 'portfolio', 'gallery', 'thoughts', 'pages']);
const ROUTES = new Map([
	['/auth/github/start', new Set(['POST'])],
	['/auth/github/callback', new Set(['GET'])],
	['/auth/logout', new Set(['POST'])],
	['/api/me', new Set(['GET'])],
	['/api/prs', new Set(['GET'])],
	['/api/prs/:number', new Set(['GET'])],
	['/api/content/create-pr', new Set(['POST'])]
]);
const rateLimitBuckets = new Map();
const DEFAULT_READ_LIMIT_PER_MINUTE = 60;
const DEFAULT_WRITE_LIMIT_PER_MINUTE = 8;
const DEFAULT_MAX_MARKDOWN_BYTES = 262_144;
const DEFAULT_MAX_TOTAL_PAYLOAD_BYTES = 10_485_760;
const DEFAULT_MAX_ASSET_BYTES = 2_097_152;
const DEFAULT_MAX_ASSETS_PER_PR = 20;
const DEFAULT_ALLOWED_ASSET_EXTENSIONS = new Set([
	// Images (cover + inline)
	'webp', 'jpg', 'jpeg', 'png', 'gif', 'svg',
	// Documents (::file component)
	'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
	// Archives
	'zip', 'rar', 'gz', 'tar', '7z',
	// Video
	'mp4', 'mov', 'mkv', 'webm',
	// Audio
	'mp3', 'wav', 'ogg', 'flac',
]);
const SESSION_COOKIE = 'raksara_admin_session';
const OAUTH_STATE_COOKIE = 'raksara_admin_oauth_state';
const ADMIN_CHALLENGE_COOKIE = 'raksara_admin_challenge';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const CHALLENGE_TTL_SECONDS = 60 * 60 * 24;

function securityHeaders() {
	return {
		'x-robots-tag': 'noindex, nofollow, noarchive',
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'DENY',
		'referrer-policy': 'no-referrer',
		'cache-control': 'no-store',
		'permissions-policy': 'camera=(), microphone=(), geolocation=()',
		'content-security-policy': "default-src 'none'; frame-ancestors 'none'"
	};
}

function json(data, init = {}, env = {}, request = null) {
	const headers = new Headers(init.headers || {});
	for (const [key, value] of Object.entries(JSON_HEADERS)) headers.set(key, value);
	for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value);
	applyCors(headers, env, request);
	return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function error(message, status = 400, env = {}, request = null) {
	return json({ error: message }, { status }, env, request);
}

function publicError(status = 400, env = {}, request = null) {
	const messages = {
		400: 'Invalid request.',
		401: 'Authentication required.',
		403: 'Access denied.',
		404: 'Not found.',
		405: 'Method not allowed.',
		413: 'Request body is too large.',
		415: 'Unsupported media type.',
		422: 'Invalid content payload.',
		429: 'Rate limit exceeded.',
		500: 'Worker error.'
	};
	return error(messages[status] || 'Request failed.', status, env, request);
}

function redirect(location, status = 302, env = {}, request = null) {
	const headers = new Headers({ location });
	for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value);
	applyCors(headers, env, request);
	return new Response(null, { status, headers });
}

function getSiteOrigin(env) {
	return String(env.RAKSARA_SITE_ORIGIN || 'http://localhost:5173').split(',')[0].replace(/\/+$/, '');
}

function adminRedirect(request, env, params = {}) {
	const url = new URL(request.url);
	const target = new URL(`${getSiteOrigin(env)}/admin/`);
	target.searchParams.set('worker', url.origin);
	for (const [key, value] of Object.entries(params)) {
		if (value != null && String(value)) target.searchParams.set(key, String(value));
	}
	return redirect(target.toString(), 302, env, request);
}

function withCookie(response, cookie) {
	const next = new Response(response.body, response);
	next.headers.append('set-cookie', cookie);
	return next;
}

function cookieSerialize(name, value, options = {}) {
	const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
	if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
	if (options.secure !== false) parts.push('Secure');
	return parts.join('; ');
}

function readableCookie(name, value, options = {}) {
	const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
	if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
	if (options.secure !== false) parts.push('Secure');
	return parts.join('; ');
}

function getCookie(request, name) {
	const cookie = request.headers.get('cookie') || '';
	for (const part of cookie.split(';')) {
		const [rawKey, ...rawValue] = part.trim().split('=');
		if (rawKey === name) return decodeURIComponent(rawValue.join('='));
	}
	return '';
}

function applyCors(headers, env, request) {
	const origin = request?.headers.get('origin') || '';
	const allowedOrigins = getAllowedOrigins(env);
	if (origin && allowedOrigins.has(origin)) {
		headers.set('access-control-allow-origin', origin);
		headers.set('access-control-allow-credentials', 'true');
		headers.set('vary', 'Origin');
	}
	headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
	headers.set('access-control-allow-headers', 'Content-Type,X-Admin-Challenge,X-API-Key,X-CSRF-Token,X-Turnstile-Token');
	headers.set('access-control-max-age', '600');
}

function getAllowedOrigins(env) {
	const configured = String(env.RAKSARA_SITE_ORIGIN || '')
		.split(',')
		.map((origin) => origin.trim().replace(/\/+$/, ''))
		.filter(Boolean);
	// Only include localhost origins in mock/dev mode — never expose them in production.
	const devOrigins = isMockMode(env)
		? ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174']
		: [];
	return new Set([...configured, ...devOrigins]);
}

function isMockMode(env) {
	return String(env.ADMIN_MOCK_MODE || '').toLowerCase() === 'true';
}

function isCookieSecure(env) {
	return String(env.ADMIN_COOKIE_SECURE || 'true').toLowerCase() !== 'false';
}

function getAdminChallengeValue(request, body = null) {
	return (
		request.headers.get('x-api-key') ||
		request.headers.get('x-admin-challenge') ||
		getCookie(request, ADMIN_CHALLENGE_COOKIE) ||
		body?.adminChallenge ||
		body?.apiKey ||
		''
	);
}

async function verifyAdminChallenge(request, env, adminConfig, body = null) {
	if (isMockMode(env)) {
		const value = getAdminChallengeValue(request, body);
		return value === (env.ADMIN_DEV_PASSPHRASE || 'local-admin');
	}
	const configuredHash = String(
		env.ADMIN_API_KEY_SHA256 || adminConfig?.security?.apiKeySha256 || adminConfig?.security?.apiKeyHash || ''
	).trim().toLowerCase();
	if (!configuredHash || configuredHash.length < 32) return false;
	const value = getAdminChallengeValue(request, body);
	if (!value) return false;
	return (await sha256Hex(value)) === configuredHash;
}

function parseLimit(value, fallback) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientId(request) {
	return (
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'local'
	);
}

function requestBucketKey(request, scope) {
	const url = new URL(request.url);
	return `${scope}:${getClientId(request)}:${url.pathname}`;
}

function checkRateLimit(request, env, scope) {
	const limit =
		scope === 'write'
			? parseLimit(env.ADMIN_WRITE_RATE_LIMIT_PER_MINUTE, DEFAULT_WRITE_LIMIT_PER_MINUTE)
			: parseLimit(env.ADMIN_READ_RATE_LIMIT_PER_MINUTE, DEFAULT_READ_LIMIT_PER_MINUTE);
	const now = Date.now();
	const windowMs = 60_000;
	const key = requestBucketKey(request, scope);
	const bucket = rateLimitBuckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
		return null;
	}
	bucket.count += 1;
	if (bucket.count > limit) {
		return {
			limit,
			retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
		};
	}
	return null;
}

function isAllowedOrigin(request, env) {
	const origin = request.headers.get('origin');
	if (!origin) return true;
	return getAllowedOrigins(env).has(origin.replace(/\/+$/, ''));
}

function matchRoute(pathname) {
	// Direct match first
	if (ROUTES.has(pathname)) return ROUTES.get(pathname);
	// Dynamic: /api/prs/:number
	if (/^\/api\/prs\/\d+$/.test(pathname)) return ROUTES.get('/api/prs/:number');
	return undefined;
}

function enforceRequestGuardrails(request, env) {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();
	const allowedMethods = matchRoute(url.pathname);
	if (!allowedMethods) {
		return publicError(404, env, request);
	}
	if (method === 'OPTIONS') return null;
	if (!allowedMethods.has(method)) {
		return publicError(405, env, request);
	}

	// Auth form-POST paths (browser navigations) are secured by admin challenge + Turnstile +
	// OAuth state — they do NOT enforce the Origin header because:
	//   1. Browsers send Origin: null after a cross-origin redirect (e.g. auth_error bounce back)
	//   2. Form submissions use navigate mode, not fetch — CORS enforcement is not meaningful here
	// API endpoints (/api/*) still enforce origin strictly via the CORS check below.
	const AUTH_FORM_PATHS = new Set(['/auth/github/start', '/auth/github/callback', '/auth/logout']);
	if (!AUTH_FORM_PATHS.has(url.pathname) && !isAllowedOrigin(request, env)) {
		return publicError(403, env, request);
	}

	if (method === 'POST') {
		const contentType = request.headers.get('content-type') || '';
		const isAuthStart = url.pathname === '/auth/github/start';
		const isLogout = url.pathname === '/auth/logout';
		if (!isAuthStart && !isLogout && !contentType.toLowerCase().includes('application/json')) {
			return publicError(415, env, request);
		}
		const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
		const maxBodyBytes = parseLimit(env.ADMIN_MAX_BODY_BYTES, DEFAULT_MAX_TOTAL_PAYLOAD_BYTES);
		if (contentLength && contentLength > maxBodyBytes) {
			return publicError(413, env, request);
		}
	}

	const limited = checkRateLimit(request, env, method === 'POST' ? 'write' : 'read');
	if (limited) {
		// Auth paths are navigated to directly by the browser (form POST → redirect).
		// Return a redirect with an error param so the user lands back on the admin page
		// instead of seeing raw JSON.
		const AUTH_REDIRECT_PATHS = ['/auth/github/start', '/auth/github/callback'];
		if (AUTH_REDIRECT_PATHS.includes(url.pathname)) {
			return adminRedirect(request, env, {
				auth_error: `Rate limit exceeded. Try again in ${limited.retryAfter} seconds.`
			});
		}
		return json(
			{
				error: 'Rate limit exceeded.',
				limit: limited.limit,
				retryAfter: limited.retryAfter
			},
			{ status: 429, headers: { 'retry-after': String(limited.retryAfter) } },
			env,
			request
		);
	}

	return null;
}

function getRepository(env) {
	const owner = String(env.GITHUB_OWNER || '').trim();
	const repo = String(env.GITHUB_REPO || '').trim();
	return owner && repo ? `${owner}/${repo}` : '';
}

function getRequiredEnv(env) {
	const missing = [];
	if (!env.GITHUB_OWNER) missing.push('GITHUB_OWNER');
	if (!env.GITHUB_REPO) missing.push('GITHUB_REPO');
	if (!env.GITHUB_DEFAULT_BRANCH) missing.push('GITHUB_DEFAULT_BRANCH');
	if (!env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
	if (!env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
	if (!env.GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
	if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) missing.push('SESSION_SECRET (must be ≥32 random chars)');
	return missing;
}

function getAuthRequiredEnv(env) {
	const missing = [];
	if (!env.GITHUB_OWNER) missing.push('GITHUB_OWNER');
	if (!env.GITHUB_REPO) missing.push('GITHUB_REPO');
	if (!env.GITHUB_DEFAULT_BRANCH) missing.push('GITHUB_DEFAULT_BRANCH');
	if (!env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
	if (!env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
	if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) missing.push('SESSION_SECRET (must be ≥32 random chars)');
	return missing;
}

function getStatus(env) {
	const repository = getRepository(env);
	if (isMockMode(env)) {
		return {
			enabled: true,
			mode: 'mock',
			repository: repository || 'mock/raksara'
		};
	}

	const missing = getRequiredEnv(env);

	if (missing.length) {
		return {
			enabled: false,
			mode: 'disabled',
			repository,
			reason: `Worker environment is incomplete: ${missing.join(', ')}.`
		};
	}

	return {
		enabled: true,
		mode: 'github',
		repository
	};
}

function bytesToBase64(bytes) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	if (typeof btoa === 'function') return btoa(binary);
	return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToBytes(value) {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = typeof atob === 'function' ? atob(normalized) : Buffer.from(normalized, 'base64').toString('binary');
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlEncodeBytes(bytes) {
	return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(value) {
	return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlDecodeString(value) {
	return new TextDecoder().decode(base64ToBytes(value));
}

function randomToken(bytes = 32) {
	const data = new Uint8Array(bytes);
	crypto.getRandomValues(data);
	return base64UrlEncodeBytes(data);
}

async function hmac(secret, value) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(String(secret)),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
	return base64UrlEncodeBytes(new Uint8Array(signed));
}

async function sha256Hex(value) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signSession(env, payload) {
	const body = base64UrlEncodeString(
		JSON.stringify({
			...payload,
			exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
		})
	);
	const sig = await hmac(env.SESSION_SECRET, body);
	return `${body}.${sig}`;
}

async function verifySession(env, token) {
	if (!token || !env.SESSION_SECRET || !token.includes('.')) return null;
	const [body, sig] = token.split('.');
	const expected = await hmac(env.SESSION_SECRET, body);
	if (sig !== expected) return null;
	try {
		const payload = JSON.parse(base64UrlDecodeString(body));
		if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
		return payload;
	} catch {
		return null;
	}
}

async function githubJson(env, path, init = {}) {
	const headers = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'raksara-admin-worker',
		'X-GitHub-Api-Version': '2022-11-28',
		...init.headers
	};
	if (init.body) headers['Content-Type'] = 'application/json';
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
	const res = await fetch(`https://api.github.com${path}`, { ...init, headers });
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		// Avoid leaking GitHub API error details (may contain repo metadata).
		// Only expose status code to help with debugging.
		throw new Error(`GitHub API request failed (HTTP ${res.status})`);
	}
	return data;
}

async function githubJsonOrNull(env, path, init = {}) {
	try {
		return await githubJson(env, path, init);
	} catch (err) {
		if (err instanceof Error && /\b404\b|Not Found/i.test(err.message)) return null;
		throw err;
	}
}

async function exchangeGithubCode(env, code) {
	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': 'raksara-admin-worker'
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code
		})
	});
	const data = await res.json().catch(() => null);
	if (!res.ok || !data?.access_token) {
		throw new Error(data?.error_description || 'GitHub OAuth token exchange failed.');
	}
	return data.access_token;
}

async function fetchGithubUser(token) {
	const res = await fetch('https://api.github.com/user', {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'User-Agent': 'raksara-admin-worker',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	});
	const data = await res.json().catch(() => null);
	if (!res.ok || !data?.login) {
		throw new Error(data?.message || 'Unable to fetch GitHub user.');
	}
	return data;
}

async function fetchGithubProfileDisplayName(env, githubUsername) {
	const username = String(githubUsername || '').trim();
	if (!username) return '';
	const profile = await githubJsonOrNull(env, `/users/${encodeURIComponent(username)}`);
	return typeof profile?.name === 'string' && profile.name.trim() ? profile.name.trim() : '';
}

async function readAuthStartBody(request) {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) return request.json().catch(() => ({}));
	if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const form = await request.formData().catch(() => null);
		if (!form) return {};
		const data = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
		// Turnstile widget injects the token as 'cf-turnstile-response'; normalise to the field name the worker expects.
		if (data['cf-turnstile-response'] && !data.turnstileToken) {
			data.turnstileToken = data['cf-turnstile-response'];
		}
		return data;
	}
	return {};
}

async function verifyTurnstile(request, env, token) {
	if (isMockMode(env)) return true;
	if (!env.ADMIN_TURNSTILE_SECRET) return { ok: false, reason: 'missing-secret' };
	if (!token) return { ok: false, reason: 'missing-token' };
	const origin = request.headers.get('origin') || '';
	const isLocalOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
	if (
		env.ADMIN_TRUST_TURNSTILE_TEST_TOKEN === 'true' &&
		isLocalOrigin &&
		token === 'XXXX.DUMMY.TOKEN.XXXX'
	) {
		return { ok: true, reason: 'trusted-local-test-token' };
	}
	const form = new FormData();
	form.set('secret', env.ADMIN_TURNSTILE_SECRET);
	form.set('response', token);
	const ip = request.headers.get('cf-connecting-ip');
	if (ip) form.set('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body: form
	});
	const data = await res.json().catch(() => null);
	return {
		ok: !!data?.success,
		reason: Array.isArray(data?.['error-codes'])
			? data['error-codes'].join(', ')
			: res.ok
				? 'verification-failed'
				: `siteverify-http-${res.status}`
	};
}

function decodeBase64Content(value) {
	const compact = String(value || '').replace(/\s/g, '');
	return base64UrlDecodeString(compact.replace(/\+/g, '-').replace(/\//g, '_'));
}

/**
 * Validate that file content matches its declared extension.
 * Checks magic bytes for binary formats and text patterns for text formats.
 */
function validateAssetContentType(content, encoding, extension) {
	const ext = String(extension || '').toLowerCase();
	if (!ext) return true;

	// For base64-encoded files, decode the first part to check magic bytes.
	if (encoding === 'base64') {
		try {
			const decoded = decodeBase64Content(content.slice(0, 100)); // Check first 100 bytes max
			const bytes = new TextEncoder().encode(decoded);
			return validateContentMagicBytes(bytes, ext);
		} catch {
			return false; // Invalid base64
		}
	}

	// For utf-8 text content, check for text patterns.
	const text = String(content || '');
	return validateContentMagicBytes(new TextEncoder().encode(text), ext);
}

/**
 * Check file magic bytes / signatures against declared extension.
 */
function validateContentMagicBytes(bytes, ext) {
	const hex = Array.from(bytes.slice(0, 12))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join(' ')
		.toUpperCase();

	switch (ext) {
		case 'png':
			// PNG magic: 89 50 4E 47 (‰PNG)
			return hex.startsWith('89 50 4E 47');
		case 'jpg':
		case 'jpeg':
			// JPEG magic: FF D8 FF
			return hex.startsWith('FF D8 FF');
		case 'gif':
			// GIF magic: 47 49 46 (GIF)
			return hex.startsWith('47 49 46');
		case 'webp':
			// WebP magic: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
			return hex.startsWith('52 49 46 46') && hex.includes('57 45 42 50');
		case 'svg':
			// SVG is text, check for XML or SVG tag
			const text = new TextDecoder().decode(bytes.slice(0, 512));
			return /<\?xml|<svg/i.test(text);
		default:
			// Unknown extension, allow it.
			return true;
	}
}

const IMAGE_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg']);
const MAX_PREVIEW_BLOB_FILES = 5;
const MAX_PREVIEW_BLOB_BASE64 = 524_288; // 512 KB per image
const MAX_PREVIEW_BLOB_TOTAL = 2_097_152; // 2 MB total

function imageMediaType(ext) {
	if (ext === 'svg') return 'image/svg+xml';
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	return `image/${ext}`;
}

function extractAdminBlock(yamlText) {
	const lines = String(yamlText || '').split(/\r?\n/);
	const start = lines.findIndex((line) => /^admin:\s*(?:#.*)?$/.test(line));
	if (start < 0) return [];
	const out = [];
	for (let i = start + 1; i < lines.length; i += 1) {
		const line = lines[i];
		if (/^\S/.test(line) && line.trim()) break;
		out.push(line);
	}
	return out;
}

function parseAdminConfigFromYaml(yamlText) {
	const block = extractAdminBlock(yamlText);
	const enabled = block.some((line) => /^\s+enabled:\s*true\s*(?:#.*)?$/i.test(line));
	const authors = [];
	let current = null;
	let section = '';
	const auth = { provider: 'github', requireTurnstile: false };
	const security = {
		maxMarkdownBytes: DEFAULT_MAX_MARKDOWN_BYTES,
		maxTotalPayloadBytes: DEFAULT_MAX_TOTAL_PAYLOAD_BYTES,
		maxAssetBytes: DEFAULT_MAX_ASSET_BYTES,
		maxAssetsPerPr: DEFAULT_MAX_ASSETS_PER_PR,
		allowedAssetExtensions: [...DEFAULT_ALLOWED_ASSET_EXTENSIONS],
		apiKeySha256: '',
		apiKeyHash: ''
	};
	for (const line of block) {
		const sectionMatch = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(?:#.*)?$/);
		if (sectionMatch) section = sectionMatch[1];
		const nestedListMatch = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(?:#.*)?$/);
		if (nestedListMatch && section === 'security') section = `security.${nestedListMatch[1]}`;
		const item = line.match(/^\s*-\s*githubUsername:\s*["']?([^"'\s#]+)["']?/);
		if (item) {
			current = { githubUsername: item[1], role: 'author' };
			authors.push(current);
			continue;
		}
		const githubUsername = line.match(/^\s+githubUsername:\s*["']?([^"'\s#]+)["']?/);
		if (githubUsername) {
			current = { githubUsername: githubUsername[1], role: 'author' };
			authors.push(current);
			continue;
		}
		const role = line.match(/^\s+role:\s*["']?([^"'\s#]+)["']?/);
		if (role && current) current.role = role[1];

		const scalar = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*["']?([^"']*?)["']?\s*(?:#.*)?$/);
		if (scalar && section === 'auth') {
			const [, key, rawValue] = scalar;
			if (key === 'provider') auth.provider = rawValue.trim() || 'github';
			if (key === 'requireTurnstile') auth.requireTurnstile = rawValue.trim().toLowerCase() === 'true';
		}
		if (scalar && section === 'security') {
			const [, key, rawValue] = scalar;
			const value = rawValue.trim();
			if (key === 'apiKeySha256' || key === 'apiKeyHash') security[key] = value;
			if (key === 'maxMarkdownBytes') security.maxMarkdownBytes = parseLimit(value, security.maxMarkdownBytes);
			if (key === 'maxTotalPayloadBytes') security.maxTotalPayloadBytes = parseLimit(value, security.maxTotalPayloadBytes);
			if (key === 'maxAssetBytes') security.maxAssetBytes = parseLimit(value, security.maxAssetBytes);
			if (key === 'maxAssetsPerPr') security.maxAssetsPerPr = parseLimit(value, security.maxAssetsPerPr);
		}
		const listItem = line.match(/^\s{6}-\s*["']?([^"'\s#]+)["']?/);
		if (listItem && section === 'security.allowedAssetExtensions') {
			security.allowedAssetExtensions.push(listItem[1].trim().toLowerCase().replace(/^\./, ''));
		}
	}
	security.allowedAssetExtensions = [...new Set(security.allowedAssetExtensions.filter(Boolean))];
	return { enabled, auth, security, allowedAuthors: authors };
}

async function fetchRepositoryAdminConfig(env) {
	// Allow a local YAML string to be injected via env (useful for local-only dev workflows
	// where the content repo on GitHub doesn't yet have a raksara.yml).
	if (env.ADMIN_LOCAL_CONFIG) {
		return parseAdminConfigFromYaml(String(env.ADMIN_LOCAL_CONFIG));
	}
	const owner = env.GITHUB_OWNER;
	const repo = env.GITHUB_REPO;
	const ref = env.GITHUB_DEFAULT_BRANCH || 'main';
	const contentRoot = String(env.CONTENT_ROOT ?? '').replace(/^\/+|\/+$/g, '');
	// Probe contentRoot/raksara.yml first (if set), then root raksara.yml.
	// Dedup so an empty contentRoot doesn't try the same path twice.
	const candidates = [...new Set([contentRoot ? `${contentRoot}/raksara.yml` : 'raksara.yml', 'raksara.yml'])];
	for (const candidate of candidates) {
		try {
			const encodedPath = candidate
				.replace(/^\/+/, '')
				.split('/')
				.map(encodeURIComponent)
				.join('/');
			const data = await githubJson(env, `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`);
			if (data?.content) return parseAdminConfigFromYaml(decodeBase64Content(data.content));
		} catch {
			// Try the next likely config location.
		}
	}
	return { enabled: false, allowedAuthors: [] };
}

async function requireAuthenticatedAuthor(request, env, adminConfig = null) {
	if (isMockMode(env)) {
		return { githubDisplayName: 'Local Dev', githubUsername: 'local-dev', githubId: 1, role: 'admin', csrfToken: 'mock-csrf' };
	}
	const token = getCookie(request, SESSION_COOKIE);
	const session = await verifySession(env, token);
	if (!session) return null;
	const resolvedConfig = adminConfig || (await fetchRepositoryAdminConfig(env));
	if (!resolvedConfig.enabled) return null;
	const author = resolvedConfig.allowedAuthors.find(
		(entry) => entry.githubUsername.toLowerCase() === String(session.githubUsername || '').toLowerCase()
	);
	if (!author) return null;
	const githubDisplayName =
		author.githubDisplayName || session.githubDisplayName || (await fetchGithubProfileDisplayName(env, session.githubUsername));
	return { ...session, githubDisplayName: githubDisplayName || session.githubUsername, role: author.role || session.role || 'author' };
}

function requireCsrf(request, user) {
	const sent = request.headers.get('x-csrf-token') || '';
	return !!sent && !!user?.csrfToken && sent === user.csrfToken;
}

function safeSlug(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function safeRepositoryPath(value, contentRoot = '') {
	const path = String(value || '')
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.replace(/\/{2,}/g, '/');
	if (!path || path.includes('\0') || path.split('/').includes('..')) return '';
	// When contentRoot is set (e.g. 'content'), require that prefix.
	// When empty (content repo root), any safe path is valid.
	if (contentRoot && !path.startsWith(contentRoot + '/')) return '';
	return path;
}

function byteLengthForContent(content, encoding = 'utf-8') {
	if (encoding === 'base64') {
		const normalized = String(content || '').replace(/\s+/g, '');
		if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return -1;
		return Math.floor((normalized.length * 3) / 4) - (normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0);
	}
	return new TextEncoder().encode(String(content || '')).byteLength;
}

function normalizeFileOperation(file, fallbackRole = 'asset', contentRoot = '') {
	if (!file || typeof file !== 'object' || Array.isArray(file)) return null;
	const path = safeRepositoryPath(file.path, contentRoot);
	const encoding = file.encoding === 'base64' ? 'base64' : 'utf-8';
	const content = typeof file.content === 'string' ? file.content : '';
	const bytes = byteLengthForContent(content, encoding);
	const role = ['content', 'asset', 'metadata'].includes(file.role) ? file.role : fallbackRole;
	if (!path || !content || bytes < 0) return null;
	return {
		path,
		content,
		encoding,
		role,
		mediaType: typeof file.mediaType === 'string' ? file.mediaType.trim() : '',
		bytes
	};
}

function fileExtensionFromPath(path) {
	const match = String(path || '').toLowerCase().match(/\.([a-z0-9]+)$/);
	return match?.[1] || '';
}

function normalizeAssetOperation(asset, contentRoot = '') {
	if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return null;
	return normalizeFileOperation(
		{
			path: asset.path,
			content: asset.contentBase64,
			encoding: 'base64',
			role: 'asset',
			mediaType: asset.mediaType
		},
		'asset',
		contentRoot
	);
}

function getSecurityLimits(adminConfig) {
	const security = adminConfig?.security || {};
	return {
		maxMarkdownBytes: parseLimit(security.maxMarkdownBytes, DEFAULT_MAX_MARKDOWN_BYTES),
		maxTotalPayloadBytes: parseLimit(security.maxTotalPayloadBytes, DEFAULT_MAX_TOTAL_PAYLOAD_BYTES),
		maxAssetBytes: parseLimit(security.maxAssetBytes, DEFAULT_MAX_ASSET_BYTES),
		maxAssetsPerPr: parseLimit(security.maxAssetsPerPr, DEFAULT_MAX_ASSETS_PER_PR),
		allowedAssetExtensions: new Set(
			(Array.isArray(security.allowedAssetExtensions) ? security.allowedAssetExtensions : [...DEFAULT_ALLOWED_ASSET_EXTENSIONS])
				.map((extension) => String(extension).toLowerCase().replace(/^\./, ''))
				.filter(Boolean)
		)
	};
}

function collectFileOperations(env, payload, adminConfig = null) {
	const contentRoot = String(env.CONTENT_ROOT ?? '').replace(/^\/+|\/+$/g, '');
	const assetPrefix = contentRoot ? `${contentRoot}/assets/` : 'assets/';
	const limits = getSecurityLimits(adminConfig);
	const markdownPath = filePathForPayload(env, payload);
	const files = [
		{
			path: markdownPath,
			content: payload.markdown,
			encoding: 'utf-8',
			role: 'content',
			mediaType: 'text/markdown; charset=utf-8',
			bytes: byteLengthForContent(payload.markdown)
		}
	];

	if (Array.isArray(payload.assets)) {
		for (const asset of payload.assets) {
			const operation = normalizeAssetOperation(asset, contentRoot);
			if (!operation) throw new Error('Asset files must include a safe content path and base64 content.');
			files.push(operation);
		}
	}

	if (Array.isArray(payload.files)) {
		for (const file of payload.files) {
			const operation = normalizeFileOperation(file, 'metadata', contentRoot);
			if (!operation) throw new Error('Additional files must include a safe content path and content.');
			files.push(operation);
		}
	}

	const seenPaths = new Set();
	let totalBytes = 0;
	let assetCount = 0;
	for (const file of files) {
		if (seenPaths.has(file.path)) throw new Error(`Duplicate file path in PR payload: ${file.path}`);
		seenPaths.add(file.path);
		if (file.role === 'content' && file.bytes > limits.maxMarkdownBytes) throw new Error(`Markdown file is too large: ${file.path}`);
		if (file.role === 'asset') {
			assetCount += 1;
			if (!file.path.startsWith(assetPrefix)) throw new Error(`Asset path is not allowed: ${file.path}`);
			if (file.bytes > limits.maxAssetBytes) throw new Error(`Asset file is too large: ${file.path}`);
			const extension = fileExtensionFromPath(file.path);
			if (!limits.allowedAssetExtensions.has(extension)) throw new Error(`Asset extension is not allowed: ${file.path}`);
			if (!validateAssetContentType(file.content, file.encoding, extension)) {
				throw new Error(`Asset content does not match declared file type: ${file.path}`);
			}
			if (extension === 'svg') {
				const svgText = file.encoding === 'base64' ? decodeBase64Content(file.content) : file.content;
				if (/<script[\s>]/i.test(svgText)) throw new Error(`SVG asset contains disallowed script content: ${file.path}`);
			}
		}
		totalBytes += file.bytes;
	}
	if (assetCount > limits.maxAssetsPerPr) throw new Error(`A PR can include at most ${limits.maxAssetsPerPr} assets.`);
	if (totalBytes > limits.maxTotalPayloadBytes) throw new Error('PR payload files are too large.');
	return files;
}

function extractContentAssetReferences(markdown, assetPrefix = 'assets/') {
	const refs = new Set();
	const text = String(markdown || '');
	const patterns = [
		/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
		/<img\b[^>]*\bsrc=["']([^"']+)["']/gi,
		/(?:src|href):\s*["']([^"']+)["']/gi,
		/(?:image|cover|thumbnail):\s*["']?([^"'\s]+)["']?/gi
	];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			const value = String(match[1] || '').split(/[?#]/)[0].replace(/^\/+/, '');
			if (value.startsWith(assetPrefix)) refs.add(value);
		}
	}
	return refs;
}

function validateAssetReferences(payload, files, assetPrefix = 'assets/') {
	const newAssetPaths = new Set(files.filter((file) => file.role === 'asset').map((file) => file.path));
	const references = extractContentAssetReferences(payload.markdown, assetPrefix);
	const missingNewAssets = [];
	for (const reference of references) {
		const inSubmittedAssets = newAssetPaths.has(reference);
		const isClearlyForSubmittedSlug = reference.includes(`/${payload.slug}/`) || reference.includes(`/${payload.slug}-`);
		if (isClearlyForSubmittedSlug && !inSubmittedAssets) missingNewAssets.push(reference);
	}
	if (missingNewAssets.length) {
		throw new Error(`Markdown references asset files that are not included in this PR: ${missingNewAssets.join(', ')}`);
	}
}

function githubBranchName(payload) {
	const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
	return `raksara-admin/${payload.type}/${payload.slug}-${timestamp}`;
}

function githubCommitMessage(payload, files) {
	const action = payload.type === 'gallery' ? 'gallery' : payload.type;
	const assetCount = files.filter((file) => file.role === 'asset').length;
	const suffix = assetCount ? ` with ${assetCount} asset${assetCount === 1 ? '' : 's'}` : '';
	return `Add ${action}: ${payload.title}${suffix}`;
}

function encodePathSegments(value) {
	return String(value || '').split('/').map(encodeURIComponent).join('/');
}

async function ensureFilesDoNotExist(env, files, baseRef) {
	const owner = env.GITHUB_OWNER;
	const repo = env.GITHUB_REPO;
	for (const file of files) {
		const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
		const existing = await githubJsonOrNull(
			env,
			`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(baseRef)}`
		);
		if (existing) throw new Error(`File already exists on ${baseRef}: ${file.path}`);
	}
}

async function ensureDuplicatePullRequestDoesNotExist(env, payload) {
	const owner = env.GITHUB_OWNER;
	const repo = env.GITHUB_REPO;
	const pulls = await githubJson(env, `/repos/${owner}/${repo}/pulls?state=open&per_page=100`);
	const title = githubCommitMessage(payload, []);
	const slugMarker = `/${payload.slug}-`;
	const duplicate = pulls.find((pr) => pr.title === title || String(pr.head?.ref || '').includes(slugMarker));
	if (duplicate) throw new Error('A matching pull request is already open.');
}

async function createGithubPullRequest(env, payload, files, user) {
	const owner = env.GITHUB_OWNER;
	const repo = env.GITHUB_REPO;
	const baseBranch = env.GITHUB_DEFAULT_BRANCH || 'main';
	const branchName = githubBranchName(payload);
	const baseRef = await githubJson(env, `/repos/${owner}/${repo}/git/ref/heads/${encodePathSegments(baseBranch)}`);
	const baseCommitSha = baseRef?.object?.sha;
	if (!baseCommitSha) throw new Error(`Unable to resolve base branch ${baseBranch}.`);
	const baseCommit = await githubJson(env, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
	const baseTreeSha = baseCommit?.tree?.sha;
	if (!baseTreeSha) throw new Error(`Unable to resolve base tree for ${baseBranch}.`);

	await ensureFilesDoNotExist(env, files, baseBranch);
	await ensureDuplicatePullRequestDoesNotExist(env, payload);

	const tree = [];
	for (const file of files) {
		const blob = await githubJson(env, `/repos/${owner}/${repo}/git/blobs`, {
			method: 'POST',
			body: JSON.stringify({
				content: file.content,
				encoding: file.encoding === 'base64' ? 'base64' : 'utf-8'
			})
		});
		tree.push({
			path: file.path,
			mode: '100644',
			type: 'blob',
			sha: blob.sha
		});
	}

	const newTree = await githubJson(env, `/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		body: JSON.stringify({
			base_tree: baseTreeSha,
			tree
		})
	});

	const commit = await githubJson(env, `/repos/${owner}/${repo}/git/commits`, {
		method: 'POST',
		body: JSON.stringify({
			message: githubCommitMessage(payload, files),
			tree: newTree.sha,
			parents: [baseCommitSha]
		})
	});

	await githubJson(env, `/repos/${owner}/${repo}/git/refs`, {
		method: 'POST',
		body: JSON.stringify({
			ref: `refs/heads/${branchName}`,
			sha: commit.sha
		})
	});

	const pr = await githubJson(env, `/repos/${owner}/${repo}/pulls`, {
		method: 'POST',
		body: JSON.stringify({
			title: githubCommitMessage(payload, files),
			head: branchName,
			base: baseBranch,
			body: [
				'Created from Raksara Admin.',
				'',
				`Author: @${user.githubUsername}`,
				`Content type: ${payload.type}`,
				`Files: ${files.length}`,
				'',
				...files.map((file) => `- ${file.path}`)
			].join('\n'),
			maintainer_can_modify: true
		})
	});

	return {
		branchName,
		filePath: files[0].path,
		files: files.map((file) => ({
			path: file.path,
			role: file.role,
			encoding: file.encoding,
			bytes: file.bytes
		})),
		pullRequest: {
			number: pr.number,
			url: pr.html_url
		}
	};
}

function validateCreatePayload(payload, adminConfig = null) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return 'Request body must be a JSON object.';
	}
	const type = String(payload.type || '').trim();
	if (!SUPPORTED_CONTENT_TYPES.has(type)) return 'Unsupported content type.';
	if (typeof payload.title !== 'string' || !payload.title.trim()) return 'Title is required.';
	const slug = safeSlug(payload.slug);
	if (!slug || slug !== payload.slug) return 'Slug must be lowercase kebab-case.';
	if (typeof payload.markdown !== 'string' || !payload.markdown.trim()) return 'Markdown is required.';
	try {
		const files = collectFileOperations({}, payload, adminConfig);
		validateAssetReferences(payload, files);
	} catch (err) {
		return err instanceof Error ? err.message : 'Invalid PR file payload.';
	}
	return '';
}

function filePathForPayload(env, payload) {
	const contentRoot = String(env.CONTENT_ROOT ?? '').replace(/^\/+|\/+$/g, '');
	const type = String(payload.type);
	const slug = safeSlug(payload.slug);
	const folder = type === 'pages' ? 'pages' : type;
	return contentRoot ? `${contentRoot}/${folder}/${slug}.md` : `${folder}/${slug}.md`;
}

function mockPullRequests() {
	const now = new Date().toISOString();
	return [
		{
			number: 1024,
			title: 'Add blog: Admin Smoke Test',
			author: 'local-dev',
			branch: 'content/blog/admin-smoke-test-local',
			url: 'https://github.com/mock/raksara/pull/1024',
			createdAt: now,
			updatedAt: now,
			draft: false
		},
		{
			number: 1023,
			title: 'Add thoughts: Weekly Reflection',
			author: 'local-dev',
			branch: 'content/thoughts/weekly-reflection-local',
			url: 'https://github.com/mock/raksara/pull/1023',
			createdAt: now,
			updatedAt: now,
			draft: true
		}
	];
}

function mockPrDetail(prNumber) {
	const now = new Date().toISOString();
	return {
		pr: {
			number: prNumber,
			title: `Mock PR #${prNumber}`,
			author: 'local-dev',
			branch: `raksara-admin/blog/mock-pr-${prNumber}`,
			url: `https://github.com/mock/raksara/pull/${prNumber}`,
			draft: false,
			createdAt: now,
			updatedAt: now
		},
		reviewStatus: 'pending',
		files: [
			{ path: `content/blog/mock-pr-${prNumber}.md`, role: 'content' },
			{ path: `content/assets/images/blog/mock-pr-${prNumber}/01-cover.webp`, role: 'asset' }
		],
		contentMarkdown: `---\ntitle: "Mock PR #${prNumber}"\ndate: ${now.slice(0, 10)}\ndraft: true\n---\n\n# Mock PR\n\nThis is a mock PR detail for preview purposes.\n`,
		blobs: {},
		blobsSkipped: false
	};
}

async function handleCreatePr(request, env) {
	const adminConfig = await fetchRepositoryAdminConfig(env);
	if (!adminConfig.enabled) return publicError(403, env, request);
	if (!(await verifyAdminChallenge(request, env, adminConfig))) return publicError(403, env, request);
	const user = await requireAuthenticatedAuthor(request, env, adminConfig);
	if (!user) return publicError(401, env, request);
	if (!requireCsrf(request, user)) return publicError(403, env, request);

	const payload = await request.json().catch(() => null);
	const validationError = validateCreatePayload(payload, adminConfig);
	if (validationError) return publicError(422, env, request);
	let files;
	try {
		files = collectFileOperations(env, payload, adminConfig);
		const contentRoot = String(env.CONTENT_ROOT ?? '').replace(/^\/+|\/+$/g, '');
		const assetPrefix = contentRoot ? `${contentRoot}/assets/` : 'assets/';
		validateAssetReferences(payload, files, assetPrefix);
	} catch (err) {
		return publicError(422, env, request);
	}

	if (!isMockMode(env)) {
		const missing = getRequiredEnv(env);
		if (missing.length) return publicError(403, env, request);
		try {
			const result = await createGithubPullRequest(env, payload, files, user);
			return json(result, { status: 201 }, env, request);
		} catch (err) {
			// GitHub API errors should not expose details to the client.
			return publicError(500, env, request);
		}
	}

	const branchName = githubBranchName(payload);
	const number = Math.floor(1000 + Math.random() * 8000);
	return json(
		{
			branchName,
			filePath: files[0].path,
			files: files.map((file) => ({
				path: file.path,
				role: file.role,
				encoding: file.encoding,
				bytes: file.bytes
			})),
			pullRequest: {
				number,
				url: `https://github.com/${getRepository(env) || 'mock/raksara'}/pull/${number}`
			}
		},
		{ status: 201 },
		env,
		request
	);
}

async function route(request, env) {
	const url = new URL(request.url);
	const blocked = enforceRequestGuardrails(request, env);
	if (blocked) return blocked;

	if (request.method === 'OPTIONS') {
		const headers = new Headers();
		for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value);
		applyCors(headers, env, request);
		return new Response(null, { status: 204, headers });
	}

	if (url.pathname === '/api/me' && request.method === 'GET') {
		const adminConfig = await fetchRepositoryAdminConfig(env);
		if (!adminConfig.enabled) return publicError(403, env, request);
		if (!(await verifyAdminChallenge(request, env, adminConfig))) return publicError(403, env, request);
		if (isMockMode(env)) {
			return json(
				{
					authenticated: true,
					user: {
						githubDisplayName: 'Local Dev',
						githubUsername: 'local-dev',
						githubId: 1,
						avatarUrl: '',
						profileUrl: 'https://github.com/local-dev',
						role: 'admin'
					},
					csrfToken: 'mock-csrf'
				},
				{},
				env,
				request
			);
		}
		const user = await requireAuthenticatedAuthor(request, env, adminConfig);
		if (!user) return publicError(401, env, request);
		const githubDisplayName =
			user.githubDisplayName || (await fetchGithubProfileDisplayName(env, user.githubUsername)) || user.githubUsername;
		return json(
			{
				authenticated: true,
				user: {
					githubDisplayName,
					githubUsername: user.githubUsername,
					githubId: user.githubId,
					avatarUrl: user.avatarUrl || '',
					profileUrl: user.profileUrl || `https://github.com/${user.githubUsername}`,
					role: user.role || 'author'
				},
				csrfToken: user.csrfToken
			},
			{},
			env,
			request
		);
	}

	if (url.pathname === '/api/prs' && request.method === 'GET') {
		const adminConfig = await fetchRepositoryAdminConfig(env);
		if (!adminConfig.enabled) return publicError(403, env, request);
		if (!(await verifyAdminChallenge(request, env, adminConfig))) return publicError(403, env, request);
		if (isMockMode(env)) return json({ pullRequests: mockPullRequests() }, {}, env, request);
		const user = await requireAuthenticatedAuthor(request, env, adminConfig);
		if (!user) return publicError(401, env, request);
		const owner = env.GITHUB_OWNER;
		const repo = env.GITHUB_REPO;
		const pulls = await githubJson(env, `/repos/${owner}/${repo}/pulls?state=open&per_page=30`);
		// Fetch review status for each PR in parallel (personal blogs have few open PRs)
		const pullRequests = await Promise.all(
			pulls.map(async (pr) => {
				let reviewStatus = 'pending';
				try {
					const reviews = await githubJson(env, `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`);
					if (Array.isArray(reviews) && reviews.length) {
						const latest = reviews[reviews.length - 1];
						if (latest.state === 'APPROVED') reviewStatus = 'approved';
						else if (latest.state === 'CHANGES_REQUESTED') reviewStatus = 'changes_requested';
					}
				} catch { /* leave as pending */ }
				return {
					number: pr.number,
					title: pr.title,
					author: pr.user?.login || '',
					branch: pr.head?.ref || '',
					url: pr.html_url,
					createdAt: pr.created_at,
					updatedAt: pr.updated_at,
					draft: !!pr.draft,
					reviewStatus
				};
			})
		);
		return json({ pullRequests }, {}, env, request);
	}

	// PR detail: GET /api/prs/:number
	if (/^\/api\/prs\/\d+$/.test(url.pathname) && request.method === 'GET') {
		const adminConfig = await fetchRepositoryAdminConfig(env);
		if (!adminConfig.enabled) return publicError(403, env, request);
		if (!(await verifyAdminChallenge(request, env, adminConfig))) return publicError(403, env, request);
		const prNumber = parseInt(url.pathname.split('/').pop(), 10);
		if (isMockMode(env)) return json(mockPrDetail(prNumber), {}, env, request);
		const user = await requireAuthenticatedAuthor(request, env, adminConfig);
		if (!user) return publicError(401, env, request);
		const owner = env.GITHUB_OWNER;
		const repo = env.GITHUB_REPO;
		try {
			const [prData, reviews, files] = await Promise.all([
				githubJson(env, `/repos/${owner}/${repo}/pulls/${prNumber}`),
				githubJson(env, `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`),
				githubJson(env, `/repos/${owner}/${repo}/pulls/${prNumber}/files`)
			]);
			// Determine review status
			let reviewStatus = 'pending';
			if (Array.isArray(reviews) && reviews.length > 0) {
				const latest = reviews[reviews.length - 1];
				if (latest.state === 'APPROVED') reviewStatus = 'approved';
				else if (latest.state === 'CHANGES_REQUESTED') reviewStatus = 'changes_requested';
			}
			// Classify files
			const _contentRoot = String(env.CONTENT_ROOT ?? '').replace(/^\/+|\/+$/g, '');
			const _assetPrefix = _contentRoot ? `${_contentRoot}/assets/` : 'assets/';
			const classifiedFiles = Array.isArray(files) ? files.map((f) => {
				const p = f.filename || '';
				const role = p.endsWith('.md') ? 'content' : p.startsWith(_assetPrefix) ? 'asset' : 'other';
				return { path: p, role };
			}) : [];
			// Fetch markdown content from first .md file
			let contentMarkdown = '';
			const mdFile = classifiedFiles.find((f) => f.role === 'content');
			if (mdFile && prData?.head?.ref) {
				const encoded = mdFile.path.split('/').map(encodeURIComponent).join('/');
				const fileData = await githubJsonOrNull(env, `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(prData.head.ref)}`);
				if (fileData?.content) {
					contentMarkdown = decodeBase64Content(fileData.content);
				}
			}

			// Fetch image asset blobs for preview (best-effort, capped)
			const imageFiles = classifiedFiles.filter((f) => {
				const ext = f.path.split('.').pop()?.toLowerCase() || '';
				return f.role === 'asset' && IMAGE_EXTENSIONS.has(ext);
			});
			const blobsSkipped = imageFiles.length > MAX_PREVIEW_BLOB_FILES;
			const blobsToFetch = imageFiles.slice(0, MAX_PREVIEW_BLOB_FILES);
			const blobs = {};
			if (prData?.head?.ref && blobsToFetch.length > 0) {
				const blobResults = await Promise.all(
					blobsToFetch.map(async (f) => {
						try {
							const encoded = f.path.split('/').map(encodeURIComponent).join('/');
							const blobData = await githubJsonOrNull(env, `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(prData.head.ref)}`);
							if (!blobData?.content) return null;
							const b64 = blobData.content.replace(/\s/g, '');
							if (b64.length > MAX_PREVIEW_BLOB_BASE64) return null;
							const ext = f.path.split('.').pop()?.toLowerCase() || '';
							return { path: f.path, base64: b64, mediaType: imageMediaType(ext) };
						} catch {
							return null;
						}
					})
				);
				let totalBytes = 0;
				for (const result of blobResults) {
					if (!result) continue;
					totalBytes += result.base64.length;
					if (totalBytes > MAX_PREVIEW_BLOB_TOTAL) break;
					blobs[result.path] = { base64: result.base64, mediaType: result.mediaType };
				}
			}

			return json({
				pr: {
					number: prData.number,
					title: prData.title,
					author: prData.user?.login || '',
					branch: prData.head?.ref || '',
					url: prData.html_url,
					draft: !!prData.draft,
					createdAt: prData.created_at,
					updatedAt: prData.updated_at
				},
				reviewStatus,
				files: classifiedFiles,
				contentMarkdown,
				blobs,
				blobsSkipped
			}, {}, env, request);
		} catch (err) {
			return publicError(500, env, request);
		}
	}

	if (url.pathname === '/api/content/create-pr' && request.method === 'POST') {
		return handleCreatePr(request, env);
	}

	if (url.pathname === '/auth/github/start' && request.method === 'POST') {
		const body = await readAuthStartBody(request);
		const adminConfig = await fetchRepositoryAdminConfig(env);
		if (!adminConfig.enabled) {
			return adminRedirect(request, env, { auth_error: 'Access denied.' });
		}
		if (!(await verifyAdminChallenge(request, env, adminConfig, body))) {
			return adminRedirect(request, env, { auth_error: 'Invalid admin challenge code.' });
		}
		if (adminConfig.auth?.requireTurnstile && !isMockMode(env) && !body.turnstileToken) {
			return adminRedirect(request, env, { auth_error: 'Turnstile verification token is missing.' });
		}
		if (adminConfig.auth?.requireTurnstile && !isMockMode(env)) {
			const turnstile = await verifyTurnstile(request, env, body.turnstileToken);
			if (!turnstile.ok) {
				const message =
					turnstile.reason === 'missing-secret'
						? 'Turnstile secret is not configured.'
						: 'Verification failed.';
				return adminRedirect(request, env, { auth_error: message });
			}
		}
		if (isMockMode(env)) {
			return withCookie(
				adminRedirect(request, env, { mockLogin: '1' }),
				cookieSerialize(ADMIN_CHALLENGE_COOKIE, getAdminChallengeValue(request, body), {
					maxAge: CHALLENGE_TTL_SECONDS,
					secure: isCookieSecure(env)
				})
			);
		}
		const missing = getAuthRequiredEnv(env);
		if (missing.length) {
			return adminRedirect(request, env, {
				auth_error: `Authentication is not configured. Missing: ${missing.join(', ')}`
			});
		}
		const state = randomToken();
		const redirectUri = `${url.origin}/auth/github/callback`;
		const target = new URL('https://github.com/login/oauth/authorize');
		target.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
		target.searchParams.set('redirect_uri', redirectUri);
		target.searchParams.set('scope', 'read:user');
		target.searchParams.set('state', state);
		let response = redirect(target.toString(), 302, env, request);
		response = withCookie(
			response,
			cookieSerialize(OAUTH_STATE_COOKIE, state, {
				maxAge: 600,
				secure: isCookieSecure(env)
			})
		);
		response = withCookie(
			response,
			cookieSerialize(ADMIN_CHALLENGE_COOKIE, getAdminChallengeValue(request, body), {
				maxAge: CHALLENGE_TTL_SECONDS,
				secure: isCookieSecure(env)
			})
		);
		return response;
	}

	if (url.pathname === '/auth/github/callback' && request.method === 'GET') {
		if (isMockMode(env)) {
			return adminRedirect(request, env, { mockLogin: '1' });
		}
		try {
			const state = url.searchParams.get('state') || '';
			const code = url.searchParams.get('code') || '';
			const expectedState = getCookie(request, OAUTH_STATE_COOKIE);
			if (!state || !code || !expectedState || state !== expectedState) {
				throw new Error('Invalid OAuth callback state. Please try signing in again.');
			}
			const userToken = await exchangeGithubCode(env, code);
			const githubUser = await fetchGithubUser(userToken);
			const adminConfig = await fetchRepositoryAdminConfig(env);
			if (!adminConfig.enabled) {
				throw new Error('Admin is disabled in repository config.');
			}
			if (!(await verifyAdminChallenge(request, env, adminConfig))) {
				throw new Error('Access denied.');
			}
			const author = adminConfig.allowedAuthors.find(
				(entry) => entry.githubUsername.toLowerCase() === String(githubUser.login).toLowerCase()
			);
			if (!author) {
				const allowed = adminConfig.allowedAuthors.map((entry) => entry.githubUsername).join(', ');
				throw new Error(
					`Sign-in failed. Access denied.`
				);
			}

			const session = await signSession(env, {
				githubDisplayName: githubUser.name || githubUser.login,
				githubUsername: githubUser.login,
				githubId: githubUser.id,
				avatarUrl: githubUser.avatar_url,
				profileUrl: githubUser.html_url,
				role: author.role || 'author',
				csrfToken: randomToken(24)
			});
			let response = adminRedirect(request, env);
			response = withCookie(
				response,
				cookieSerialize(SESSION_COOKIE, session, {
					maxAge: SESSION_TTL_SECONDS,
					secure: isCookieSecure(env)
				})
			);
			response = withCookie(
				response,
				cookieSerialize(OAUTH_STATE_COOKIE, '', {
					maxAge: 0,
					secure: isCookieSecure(env)
				})
			);
			return response;
		} catch (err) {
			return withCookie(
				adminRedirect(request, env, {
					auth_error: err instanceof Error ? err.message : 'GitHub sign-in failed.'
				}),
				cookieSerialize(OAUTH_STATE_COOKIE, '', {
					maxAge: 0,
					secure: isCookieSecure(env)
				})
			);
		}
	}

	if (url.pathname === '/auth/logout' && request.method === 'POST') {
		const adminConfig = await fetchRepositoryAdminConfig(env);
		if (!adminConfig.enabled) {
			return publicError(403, env, request);
		}
		const user = await requireAuthenticatedAuthor(request, env, adminConfig);
		if (!user) {
			return publicError(401, env, request);
		}
		if (!isMockMode(env) && !requireCsrf(request, user)) {
			return publicError(403, env, request);
		}
		const redirectUrl = new URL(`${getSiteOrigin(env)}/admin/`);
		redirectUrl.searchParams.set('worker', url.origin);
		redirectUrl.searchParams.set('logout', '1');
		let response = json({ ok: true, redirectUrl: redirectUrl.toString() }, {}, env, request);
		response = withCookie(
			response,
			cookieSerialize(SESSION_COOKIE, '', {
				maxAge: 0,
				secure: isCookieSecure(env)
			})
		);
		response = withCookie(
			response,
			cookieSerialize(OAUTH_STATE_COOKIE, '', {
				maxAge: 0,
				secure: isCookieSecure(env)
			})
		);
		response = withCookie(
			response,
			cookieSerialize(ADMIN_CHALLENGE_COOKIE, '', {
				maxAge: 0,
				secure: isCookieSecure(env)
			})
		);
		return response;
	}

	return error('Not found.', 404, env, request);
}

export default {
	fetch(request, env) {
		return route(request, env).catch((err) => {
			const url = new URL(request.url);
			if (url.pathname.startsWith('/auth/')) {
				return adminRedirect(request, env, {
					[url.pathname === '/auth/logout' ? 'logout_error' : 'auth_error']:
						err instanceof Error ? err.message : 'Authentication flow failed.'
				});
			}
			return publicError(500, env, request);
		});
	}
};

export { route };
