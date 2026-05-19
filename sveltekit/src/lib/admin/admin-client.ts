export interface WorkerStatus {
	enabled: boolean;
	reason?: string;
	mode?: 'mock' | 'github' | 'disabled';
	repository?: string;
}

export interface AdminSessionResponse {
	authenticated: boolean;
	user: AdminUser;
	csrfToken?: string;
}

export interface AdminUser {
	githubDisplayName?: string;
	githubUsername: string;
	githubId?: number;
	avatarUrl?: string;
	profileUrl?: string;
}

export interface AdminPullRequest {
	number: number;
	title: string;
	author: string;
	branch: string;
	url: string;
	createdAt: string;
	updatedAt: string;
	draft?: boolean;
	reviewStatus?: 'approved' | 'changes_requested' | 'pending';
}

export interface AdminFileOperation {
	path: string;
	content: string;
	encoding?: 'utf-8' | 'base64';
	mediaType?: string;
	role?: 'content' | 'asset' | 'metadata';
}

export interface AdminAssetUpload {
	path: string;
	contentBase64: string;
	mediaType: string;
	alt?: string;
	caption?: string;
}

export interface CreateContentPrPayload {
	type: string;
	title: string;
	slug: string;
	markdown: string;
	frontmatter?: Record<string, unknown>;
	assets?: AdminAssetUpload[];
	files?: AdminFileOperation[];
	prev?: string | null;
	next?: string | null;
}

export interface CreateContentPrResponse {
	branchName: string;
	filePath: string;
	files: Array<{
		path: string;
		role: 'content' | 'asset' | 'metadata';
		encoding: 'utf-8' | 'base64';
		bytes: number;
	}>;
	pullRequest: {
		number: number;
		url: string;
	};
}

export interface AdminLogoutResponse {
	ok: boolean;
	redirectUrl: string;
}

export interface AdminPrDetail {
	pr: {
		number: number;
		title: string;
		author: string;
		branch: string;
		url: string;
		draft: boolean;
		createdAt: string;
		updatedAt: string;
	};
	reviewStatus: 'approved' | 'changes_requested' | 'pending';
	files: Array<{
		path: string;
		role: 'content' | 'asset' | 'other';
	}>;
	contentMarkdown: string;
	blobs?: Record<string, { base64: string; mediaType: string }>;
	blobsSkipped?: boolean;
}

function readErrorMessage(data: unknown, status: number): string {
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		const record = data as Record<string, unknown>;
		if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
		if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
	}
	return `Worker request failed with ${status}`;
}

async function request<T>(
	workerUrl: string,
	path: string,
	init?: RequestInit,
	security?: { adminChallenge?: string; csrfToken?: string }
): Promise<T> {
	const res = await fetch(`${workerUrl.replace(/\/+$/, '')}${path}`, {
		credentials: 'include',
		headers: {
			Accept: 'application/json',
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...(security?.adminChallenge ? { 'X-Admin-Challenge': security.adminChallenge } : {}),
			...(security?.csrfToken ? { 'X-CSRF-Token': security.csrfToken } : {}),
			...init?.headers
		},
		...init
	});
	const contentType = res.headers.get('content-type') || '';
	const data = contentType.includes('application/json')
		? await res.json().catch(() => null)
		: await res.text().catch(() => '');
	if (!res.ok) {
		throw new Error(readErrorMessage(data, res.status));
	}
	if (typeof data === 'string') return {} as T;
	return (data ?? {}) as T;
}

export const adminClient = {
	me(workerUrl: string, adminChallenge: string) {
		return request<AdminSessionResponse>(workerUrl, '/api/me', undefined, { adminChallenge });
	},
	prs(workerUrl: string, adminChallenge: string) {
		return request<{ pullRequests: AdminPullRequest[] }>(workerUrl, '/api/prs', undefined, { adminChallenge });
	},
	prDetail(workerUrl: string, prNumber: number, adminChallenge: string) {
		return request<AdminPrDetail>(workerUrl, `/api/prs/${prNumber}`, undefined, { adminChallenge });
	},
	createContentPr(workerUrl: string, payload: CreateContentPrPayload, security: { adminChallenge: string; csrfToken: string }) {
		return request<CreateContentPrResponse>(workerUrl, '/api/content/create-pr', {
			method: 'POST',
			body: JSON.stringify(payload)
		}, security);
	},
	logout(workerUrl: string, csrfToken?: string) {
		return request<AdminLogoutResponse>(
			workerUrl,
			'/auth/logout',
			{ method: 'POST' },
			csrfToken ? { csrfToken } : undefined
		);
	}
};
