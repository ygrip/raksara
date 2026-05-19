export interface AdminAuthor {
	githubUsername: string;
	displayName?: string;
	role: string;
}

export interface ResolvedAdminConfig {
	enabled: boolean;
	reason?: string;
	workerUrl?: string;
	allowedAuthors: AdminAuthor[];
	auth: {
		provider: 'github';
		requireTurnstile: boolean;
	};
	features: {
		createPullRequest: boolean;
		allowAssetUpload: boolean;
		allowPrevNextSelection: boolean;
		allowCustomComponents: boolean;
	};
}

const disabledFeatures = {
	createPullRequest: false,
	allowAssetUpload: false,
	allowPrevNextSelection: false,
	allowCustomComponents: false
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function normalizeWorkerUrl(value: unknown): string {
	if (typeof value !== 'string') return '';
	const trimmed = value.trim().replace(/\/+$/, '');
	if (!/^https?:\/\//i.test(trimmed)) return '';
	return trimmed;
}

function normalizeAuthors(value: unknown): AdminAuthor[] {
	if (!Array.isArray(value)) return [];
	return value
		.map<AdminAuthor | null>((entry) => {
			const author = asRecord(entry);
			if (!author || typeof author.githubUsername !== 'string') return null;
			const githubUsername = author.githubUsername.trim();
			if (!githubUsername) return null;
			const normalized: AdminAuthor = {
				githubUsername,
				role: typeof author.role === 'string' && author.role.trim() ? author.role.trim() : 'author'
			};
			if (typeof author.displayName === 'string') normalized.displayName = author.displayName;
			return normalized;
		})
		.filter((entry): entry is AdminAuthor => entry !== null);
}

export function resolveAdminConfig(config: unknown): ResolvedAdminConfig {
	const root = asRecord(config);
	const admin = asRecord(root?.admin);
	if (!admin) {
		return {
			enabled: false,
			reason: 'Admin config is not present in raksara.yml.',
			allowedAuthors: [],
			auth: { provider: 'github', requireTurnstile: false },
			features: disabledFeatures
		};
	}

	if (admin.enabled !== true) {
		return {
			enabled: false,
			reason: 'Admin is disabled in raksara.yml.',
			allowedAuthors: [],
			auth: { provider: 'github', requireTurnstile: false },
			features: disabledFeatures
		};
	}

	const workerUrl = normalizeWorkerUrl(admin.workerUrl);
	if (!workerUrl) {
		return {
			enabled: false,
			reason: 'Admin workerUrl is missing or invalid.',
			allowedAuthors: [],
			auth: { provider: 'github', requireTurnstile: false },
			features: disabledFeatures
		};
	}

	const allowedAuthors = normalizeAuthors(admin.allowedAuthors);
	if (!allowedAuthors.length) {
		return {
			enabled: false,
			reason: 'Admin has no valid allowedAuthors entries.',
			allowedAuthors: [],
			auth: { provider: 'github', requireTurnstile: false },
			features: disabledFeatures
		};
	}

	const content = asRecord(admin.content);
	const auth = asRecord(admin.auth);
	return {
		enabled: true,
		workerUrl,
		allowedAuthors,
		auth: {
			provider: 'github',
			requireTurnstile: auth?.requireTurnstile === true
		},
		features: {
			createPullRequest: content?.createPullRequest !== false,
			allowAssetUpload: content?.allowAssetUpload !== false,
			allowPrevNextSelection: content?.allowPrevNextSelection === true,
			allowCustomComponents: content?.allowCustomComponents !== false
		}
	};
}
