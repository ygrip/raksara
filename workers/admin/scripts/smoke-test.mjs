const base = process.env.WORKER_URL || 'http://localhost:8787';
const adminChallenge = process.env.ADMIN_DEV_PASSPHRASE || 'local-admin';

async function assertOk(label, promise) {
	const res = await promise;
	if (!res.ok) {
		throw new Error(`${label} failed: ${res.status} ${await res.text()}`);
	}
	return res.json();
}

const authStart = await fetch(`${base}/auth/github/start`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'x-admin-challenge': adminChallenge },
	body: JSON.stringify({ adminChallenge }),
	redirect: 'manual'
});
if (authStart.status !== 302) throw new Error(`auth start failed: ${authStart.status} ${await authStart.text()}`);

const me = await assertOk('me', fetch(`${base}/api/me`, { headers: { 'x-admin-challenge': adminChallenge } }));
if (me.user?.githubUsername !== 'local-dev') throw new Error('Mock user shape is invalid');
if (!me.csrfToken) throw new Error('CSRF token is missing');

const prs = await assertOk('prs', fetch(`${base}/api/prs`, { headers: { 'x-admin-challenge': adminChallenge } }));
if (!Array.isArray(prs.pullRequests)) throw new Error('PR list shape is invalid');

const slug = `admin-smoke-test-${Date.now()}`;
const created = await assertOk(
	'create-pr',
	fetch(`${base}/api/content/create-pr`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-admin-challenge': adminChallenge,
			'x-csrf-token': me.csrfToken
		},
		body: JSON.stringify({
			type: 'blog',
			title: 'Admin Smoke Test',
			slug,
			markdown: `---\ntitle: Admin Smoke Test\n---\n\n# Admin Smoke Test\n`,
			assets: [
				{
					path: `content/assets/images/${slug}.svg`,
					contentBase64: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=',
					mediaType: 'image/svg+xml',
					caption: 'Smoke asset'
				}
			]
		})
	})
);

if (!Array.isArray(created.files) || created.files.length !== 2) {
	throw new Error('Create PR did not return both file operations');
}

console.log(JSON.stringify({ me: me.user.githubUsername, prs: prs.pullRequests.length, created }, null, 2));
