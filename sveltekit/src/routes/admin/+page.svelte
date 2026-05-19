<script lang="ts">
	import { onMount } from 'svelte';
	import {
		adminClient,
		type AdminAssetUpload,
		type AdminPrDetail,
		type AdminPullRequest,
		type AdminUser,
		type WorkerStatus
	} from '$lib/admin/admin-client';
	import {
		buildAssetPath,
		buildCoverAssetPath,
		buildContentPrPayload,
		createDefaultContentForm,
		hasCoverField,
		hasPrevNextField,
		slugifyAdmin,
		type NavRef
	} from '$lib/admin/content-form';
	import { getComponentsForType } from '$lib/admin/custom-components';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let workerUrl = $state('http://localhost:8787');
	let workerStatus = $state<WorkerStatus | null>(null);
	let adminUser = $state<AdminUser | null>(null);
	let adminChallenge = $state('');
	let challengeInput = $state('');
	let adminUnlocked = $state(false);
	let csrfToken = $state('');
	let pullRequests = $state<AdminPullRequest[]>([]);
	let activeTab = $state<'create' | 'prs'>('create');
	let prsLoaded = $state(false);
	let contentForm = $state(createDefaultContentForm());
	let contentAssets = $state<AdminAssetUpload[]>([]);
	// PR search/filter
	let prSearchQuery = $state('');
	let prStatusFilter = $state<'all' | 'open' | 'needs_works' | 'approved'>('all');
	// PR detail modal
	let activePr = $state<AdminPullRequest | null>(null);
	let prDetail = $state<AdminPrDetail | null>(null);
	let isLoadingPrDetail = $state(false);
	let prDetailError = $state('');
	let prFilesExpanded = $state(false);
	let branchCopied = $state(false);
	let createResult = $state('');
	let createError = $state('');
	let formError = $state('');
	let authError = $state('');
	let authNotice = $state('');
	let isLocalAdminHost = $state(false);
	let turnstileToken = $state('');
	let turnstileStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let apiToast = $state<{ kind: 'error' | 'success'; message: string } | null>(null);
	let isToastClosing = $state(false);
	let isLoadingPrs = $state(false);
	let isLoadingAuth = $state(false);
	let isCreatingPr = $state(false);
	let isSigningOut = $state(false);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	// Tag chip selector
	let tagInput = $state('');
	let tagDropdownOpen = $state(false);
	let tagInputEl: HTMLInputElement | null = $state(null);

	// Category chip selector
	let catInput = $state('');
	let catDropdownOpen = $state(false);
	let catInputEl: HTMLInputElement | null = $state(null);

	// URL field errors
	let githubError = $state('');
	let demoError = $state('');

	// Prev / next page picker popup
	let navPickerOpen = $state<'prev' | 'next' | null>(null);
	let navPickerSearch = $state('');

	// Body editor
	let bodyTabMode = $state<'write' | 'preview'>('write');
	let showComponentToolbar = $state(false);
	let bodyTextareaEl: HTMLTextAreaElement | null = $state(null);
	// Inline image file input (hidden)
	let inlineImageInputEl: HTMLInputElement | null = $state(null);

	// --- Derived ---
	const activeWorkerUrl = $derived(workerUrl.trim().replace(/\/+$/, ''));
	const loginUrl = $derived(activeWorkerUrl ? `${activeWorkerUrl}/auth/github/start` : '');
	const contentPayload = $derived(buildContentPrPayload(contentForm, contentAssets, contentForm.coverAsset));
	const showCoverField = $derived(hasCoverField(contentForm));
	const filteredComponents = $derived(getComponentsForType(contentForm.type, contentForm.subtype));
	const filteredPullRequests = $derived(
		pullRequests.filter((pr) => {
			const matchesSearch = !prSearchQuery.trim() ||
				pr.title.toLowerCase().includes(prSearchQuery.trim().toLowerCase());
			const matchesStatus =
				prStatusFilter === 'all' ||
				(prStatusFilter === 'open' && !pr.draft && pr.reviewStatus !== 'approved' && pr.reviewStatus !== 'changes_requested') ||
				(prStatusFilter === 'needs_works' && pr.reviewStatus === 'changes_requested') ||
				(prStatusFilter === 'approved' && pr.reviewStatus === 'approved');
			return matchesSearch && matchesStatus;
		})
	);
	const currentSlug = $derived(slugifyAdmin(contentForm.slug || contentForm.title));
	const slugExists = $derived(!!currentSlug && data.existingSlugs.includes(currentSlug));
	const showPrevNextField = $derived(hasPrevNextField(contentForm));
	const navItemsForType = $derived(
		contentForm.type === 'blog'
			? data.navItems.filter((i) => i.section === 'blog')
			: contentForm.type === 'pages'
			? data.navItems.filter((i) => i.section === 'pages')
			: []
	);
	const navPickerItems = $derived(
		navItemsForType.filter((i) => {
			const q = navPickerSearch.trim().toLowerCase();
			// Exclude whichever the other slot already has
			const otherSlug = navPickerOpen === 'prev'
				? contentForm.nextPage?.slug
				: contentForm.prevPage?.slug;
			const notOther = !otherSlug || i.slug !== otherSlug;
			if (!q) return notOther;
			return notOther && (i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q));
		})
	);

	const turnstileRequired = $derived(data.admin.auth.requireTurnstile);
	const effectiveTurnstileSiteKey = $derived(
		isLocalAdminHost ? '1x00000000000000000000AA' : PUBLIC_TURNSTILE_SITE_KEY
	);
	const turnstileReady = $derived(!turnstileRequired || !!effectiveTurnstileSiteKey);
	const githubSignInDisabled = $derived(!turnstileReady || (turnstileRequired && !turnstileToken));

	const filteredTags = $derived(
		data.existingTags
			.filter(
				(t) =>
					!contentForm.tags.includes(t) &&
					(!tagInput.trim() || t.toLowerCase().includes(tagInput.trim().toLowerCase()))
			)
			.slice(0, 14)
	);

	const filteredCats = $derived(
		data.existingCategories
			.filter((c) => !catInput.trim() || c.toLowerCase().includes(catInput.trim().toLowerCase()))
			.slice(0, 10)
	);

	const PORTFOLIO_STATUSES = [
		{ value: '', label: 'No status', color: '' },
		{ value: 'planned', label: 'Planned', color: '#a78bfa' },
		{ value: 'ongoing', label: 'Ongoing', color: '#34d399' },
		{ value: 'completed', label: 'Completed', color: '#60a5fa' },
		{ value: 'archived', label: 'Archived', color: '#9ca3af' },
		{ value: 'paused', label: 'Paused', color: '#fbbf24' }
	] as const;

	const currentStatus = $derived(
		PORTFOLIO_STATUSES.find((s) => s.value === contentForm.status) ?? PORTFOLIO_STATUSES[0]
	);

	const resolvedDisplayName = $derived(
		(() => {
			const user = adminUser;
			if (!user) return '';
			if (user.githubDisplayName?.trim()) return user.githubDisplayName.trim();
			const matchedAuthor = data.admin.allowedAuthors.find(
				(author) => author.githubUsername.toLowerCase() === user.githubUsername.toLowerCase()
			);
			return matchedAuthor?.displayName || user.githubUsername;
		})()
	);

	// --- Helpers ---
	type TurnstileApi = {
		render: (
			container: HTMLElement,
			options: {
				sitekey: string;
				callback: (token: string) => void;
				'expired-callback': () => void;
				'error-callback': () => void;
				'response-field': boolean;
			}
		) => string;
		remove?: (widgetId: string) => void;
	};

	let turnstileScriptPromise: Promise<void> | null = null;

	function getTurnstileApi() {
		return (window as Window & typeof globalThis & { turnstile?: TurnstileApi }).turnstile;
	}

	function loadTurnstileScript() {
		if (getTurnstileApi()) return Promise.resolve();
		if (turnstileScriptPromise) return turnstileScriptPromise;
		turnstileScriptPromise = new Promise<void>((resolve, reject) => {
			const existing = document.querySelector<HTMLScriptElement>('script[data-raksara-turnstile]');
			if (existing) {
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', () => reject(new Error('Unable to load Turnstile.')), { once: true });
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.defer = true;
			script.dataset.raksaraTurnstile = 'true';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Unable to load Turnstile.'));
			document.head.appendChild(script);
		});
		return turnstileScriptPromise;
	}

	function renderTurnstile(node: HTMLElement) {
		let widgetId = '';
		let destroyed = false;
		async function init() {
			if (!turnstileReady || !effectiveTurnstileSiteKey) return;
			turnstileToken = '';
			turnstileStatus = 'loading';
			try {
				await loadTurnstileScript();
				if (destroyed) return;
				const turnstile = getTurnstileApi();
				if (!turnstile) throw new Error('Turnstile is unavailable.');
				node.innerHTML = '';
				widgetId = turnstile.render(node, {
					sitekey: effectiveTurnstileSiteKey,
					callback: (token: string) => {
						turnstileToken = token;
						turnstileStatus = token ? 'ready' : 'idle';
					},
					'expired-callback': () => {
						turnstileToken = '';
						turnstileStatus = 'idle';
					},
					'error-callback': () => {
						turnstileToken = '';
						turnstileStatus = 'error';
					},
					'response-field': false
				});
			} catch {
				turnstileToken = '';
				turnstileStatus = 'error';
			}
		}
		void init();
		return {
			destroy() {
				destroyed = true;
				const turnstile = getTurnstileApi();
				if (widgetId && turnstile?.remove) turnstile.remove(widgetId);
			}
		};
	}

	function getAdminChallengeCookie() {
		const match = document.cookie.match(/(?:^|;\s*)raksara_admin_challenge=([^;]+)/);
		return match ? decodeURIComponent(match[1]) : '';
	}

	function setAdminChallengeCookie(value: string) {
		const secure = !isLocalAdminHost ? '; Secure' : '';
		document.cookie = `raksara_admin_challenge=${encodeURIComponent(value)}; Max-Age=86400; Path=/; SameSite=Lax${secure}`;
	}

	function clearAdminChallengeCookie() {
		document.cookie = 'raksara_admin_challenge=; Max-Age=0; Path=/; SameSite=Lax';
	}

	function clearToastTimer() {
		if (!toastTimer) return;
		clearTimeout(toastTimer);
		toastTimer = null;
	}

	function dismissApiToast() {
		if (!apiToast || isToastClosing) return;
		clearToastTimer();
		isToastClosing = true;
		setTimeout(() => {
			apiToast = null;
			isToastClosing = false;
		}, 220);
	}

	function showApiToast(kind: 'error' | 'success', message: string) {
		clearToastTimer();
		isToastClosing = false;
		apiToast = { kind, message };
		toastTimer = setTimeout(() => {
			dismissApiToast();
		}, 3000);
	}

	function showApiError(context: string, error: unknown, fallbackMessage: string) {
		const message = error instanceof Error && error.message.trim() ? error.message.trim() : fallbackMessage;
		showApiToast('error', `${context}: ${message}`);
	}

	async function signOut(event?: Event) {
		event?.preventDefault();
		if (!activeWorkerUrl || isSigningOut) return;
		isSigningOut = true;
		clearToastTimer();
		apiToast = null;
		isToastClosing = false;
		try {
			const result = await adminClient.logout(activeWorkerUrl, csrfToken || undefined);
			window.location.href = result.redirectUrl || `${activeWorkerUrl}/admin/`;
		} catch (error) {
			showApiError('Sign out failed', error, 'We could not sign you out right now.');
		} finally {
			isSigningOut = false;
		}
	}

	function unlockAdmin(event?: Event) {
		event?.preventDefault();
		const value = challengeInput.trim();
		if (!value) {
			authError = 'Challenge code is required.';
			return;
		}
		setAdminChallengeCookie(value);
		adminChallenge = value;
		adminUnlocked = true;
		authError = '';
		void loadWorkerSession();
	}

	function denyAdmin() {
		clearAdminChallengeCookie();
		window.location.href = '/';
	}

	function validateUrl(value: string): string {
		if (!value.trim()) return '';
		try {
			const url = new URL(value.trim());
			if (!['http:', 'https:'].includes(url.protocol)) return 'Must be an http(s):// URL.';
			return '';
		} catch {
			return 'Not a valid URL.';
		}
	}

	function updateTitle(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		contentForm.title = value;
		contentForm.slug = slugifyAdmin(value);
	}

	function updateSlug(event: Event) {
		contentForm.slug = slugifyAdmin((event.currentTarget as HTMLInputElement).value);
	}

	function setContentType(event: Event) {
		contentForm.type = (event.currentTarget as HTMLSelectElement).value;
		// Reset subtype for non-blog
		if (contentForm.type !== 'blog') contentForm.subtype = '';
		// Reset cover for types that don't support it
		if (!hasCoverField(contentForm)) contentForm.coverAsset = undefined;
		// Reset prev/next for types that don't support it
		if (!hasPrevNextField(contentForm)) { contentForm.prevPage = null; contentForm.nextPage = null; navPickerOpen = null; }
		contentAssets = contentAssets.map((asset, index) => ({
			...asset,
			path: buildAssetPath(
				contentForm.type,
				contentForm.slug || contentForm.title,
				asset.path.split('/').pop() || 'asset',
				index
			)
		}));
	}

	// Tags
	function addTag(tag: string) {
		const t = tag.trim().toLowerCase();
		if (t && !contentForm.tags.includes(t)) contentForm.tags = [...contentForm.tags, t];
		tagInput = '';
		tagDropdownOpen = true;
		tagInputEl?.focus();
	}

	function removeTag(tag: string) {
		contentForm.tags = contentForm.tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (tagInput.trim()) addTag(tagInput.trim());
		} else if (event.key === 'Backspace' && !tagInput && contentForm.tags.length) {
			contentForm.tags = contentForm.tags.slice(0, -1);
		} else if (event.key === 'Escape') {
			tagDropdownOpen = false;
		}
	}

	// Category (single-select chip)
	function selectCategory(cat: string) {
		contentForm.category = cat;
		catInput = '';
		catDropdownOpen = false;
	}

	function clearCategory() {
		contentForm.category = '';
	}

	function handleCatKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (catInput.trim()) {
				selectCategory(catInput.trim());
				catInputEl?.blur();
			}
		} else if (event.key === 'Backspace' && !catInput && contentForm.category) {
			clearCategory();
		} else if (event.key === 'Escape') {
			catDropdownOpen = false;
		}
	}

	// Assets
	function readFileAsBase64(file: File) {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
			reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
			reader.readAsDataURL(file);
		});
	}

	async function addAssetFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files || []);
		if (!files.length) return;
		formError = '';
		try {
			const nextAssets = [...contentAssets];
			for (const file of files) {
				const index = nextAssets.length;
				nextAssets.push({
					path: buildAssetPath(
						contentForm.type,
						contentForm.slug || contentForm.title,
						file.name,
						index
					),
					contentBase64: await readFileAsBase64(file),
					mediaType: file.type || 'application/octet-stream',
					alt: file.name.replace(/\.[^.]+$/, ''),
					caption: file.name.replace(/\.[^.]+$/, '')
				});
			}
			contentAssets = nextAssets;
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Unable to add asset files';
		} finally {
			input.value = '';
		}
	}

	function removeAsset(path: string) {
		contentAssets = contentAssets.filter((asset) => asset.path !== path);
	}

	function updateAssetField(path: string, field: 'alt' | 'caption', value: string) {
		contentAssets = contentAssets.map((asset) =>
			asset.path === path ? { ...asset, [field]: value } : asset
		);
	}

	function insertSnippet(snippet: string) {
		const normalized = snippet.replace(/\\n/g, '\n');
		const el = bodyTextareaEl;
		if (!el) {
			contentForm.body = (contentForm.body ? contentForm.body + '\n\n' : '') + normalized;
			return;
		}
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const text = contentForm.body;
		const needsLeading = start > 0 && text[start - 1] !== '\n';
		const insert = (needsLeading ? '\n\n' : '') + normalized;
		contentForm.body = text.slice(0, start) + insert + text.slice(end);
		requestAnimationFrame(() => {
			el.focus();
			const pos = start + insert.length;
			el.setSelectionRange(pos, pos);
		});
	}

	// ---- Markdown formatting toolbar ----

	function wrapSelection(before: string, after: string) {
		const el = bodyTextareaEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const text = contentForm.body;
		const selected = text.slice(start, end) || 'text';
		const insert = before + selected + after;
		contentForm.body = text.slice(0, start) + insert + text.slice(end);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + before.length, start + before.length + selected.length);
		});
	}

	function prefixLines(prefix: string) {
		const el = bodyTextareaEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const text = contentForm.body;
		const selected = text.slice(start, end);
		if (selected) {
			const prefixed = selected.split('\n').map((l) => prefix + l).join('\n');
			contentForm.body = text.slice(0, start) + prefixed + text.slice(end);
			requestAnimationFrame(() => { el.focus(); });
		} else {
			// insert at start of line
			const lineStart = text.lastIndexOf('\n', start - 1) + 1;
			contentForm.body = text.slice(0, lineStart) + prefix + text.slice(lineStart);
			requestAnimationFrame(() => {
				el.focus();
				el.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
			});
		}
	}

	function fmtBold() { wrapSelection('**', '**'); }
	function fmtItalic() { wrapSelection('*', '*'); }
	function fmtStrike() { wrapSelection('~~', '~~'); }
	function fmtH1() { prefixLines('# '); }
	function fmtH2() { prefixLines('## '); }
	function fmtH3() { prefixLines('### '); }
	function fmtBullet() { prefixLines('- '); }
	function fmtNumbered() { prefixLines('1. '); }
	function fmtBlockquote() { prefixLines('> '); }
	function fmtCode() { wrapSelection('```\n', '\n```'); }
	function fmtHr() { insertSnippet('\n---\n'); }
	function fmtInlineImage() { inlineImageInputEl?.click(); }

	// ---- Asset / cover / inline-image ----

	async function addCoverFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		formError = '';
		try {
			const slug = contentForm.slug || contentForm.title;
			const path = buildCoverAssetPath(contentForm.type, slug, file.name);
			contentForm.coverAsset = {
				path,
				contentBase64: await readFileAsBase64(file),
				mediaType: file.type || 'image/jpeg',
				alt: file.name.replace(/\.[^.]+$/, '')
			};
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Unable to read cover file';
		} finally {
			input.value = '';
		}
	}

	function removeCover() {
		contentForm.coverAsset = undefined;
	}

	async function addInlineImageFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		formError = '';
		try {
			const index = contentAssets.length;
			const path = buildAssetPath(contentForm.type, contentForm.slug || contentForm.title, file.name, index);
			const asset: AdminAssetUpload = {
				path,
				contentBase64: await readFileAsBase64(file),
				mediaType: file.type || 'application/octet-stream',
				alt: file.name.replace(/\.[^.]+$/, '')
			};
			contentAssets = [...contentAssets, asset];
			// Insert markdown image at cursor
			const el = bodyTextareaEl;
			const imgMd = `![${asset.alt || 'image'}](${path})`;
			if (el) {
				const pos = el.selectionStart;
				const text = contentForm.body;
				contentForm.body = text.slice(0, pos) + imgMd + text.slice(pos);
				requestAnimationFrame(() => {
					el.focus();
					el.setSelectionRange(pos + imgMd.length, pos + imgMd.length);
				});
			} else {
				contentForm.body += (contentForm.body ? '\n\n' : '') + imgMd;
			}
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Unable to read image file';
		} finally {
			input.value = '';
		}
	}

	// ---- PR detail modal ----

	async function loadPrDetail(pr: AdminPullRequest) {
		activePr = pr;
		prDetail = null;
		prDetailError = '';
		prFilesExpanded = false;
		branchCopied = false;
		isLoadingPrDetail = true;
		try {
			prDetail = await adminClient.prDetail(activeWorkerUrl, pr.number, adminChallenge);
		} catch (err) {
			prDetailError = err instanceof Error ? err.message : 'Unable to load PR details.';
		} finally {
			isLoadingPrDetail = false;
		}
	}

	function closePrDetail() {
		activePr = null;
		prDetail = null;
		prDetailError = '';
		prFilesExpanded = false;
		branchCopied = false;
	}

	async function copyBranch(branch: string) {
		try {
			await navigator.clipboard.writeText(branch);
			branchCopied = true;
			setTimeout(() => (branchCopied = false), 2000);
		} catch {
			// clipboard not available — silent fail
		}
	}

	/** Replace asset paths in markdown/frontmatter with data: URIs from the blob map.
	 *  Handles both bare paths (content/assets/...) and slash-prefixed (/content/assets/...)
	 *  since buildFrontmatter emits slash-prefixed paths but blob keys are bare GitHub paths. */
	function injectBlobsIntoText(text: string, blobs: Record<string, { base64: string; mediaType: string }>): string {
		if (!blobs || Object.keys(blobs).length === 0) return text;
		let result = text;
		for (const [path, { base64, mediaType }] of Object.entries(blobs)) {
			const dataUri = `data:${mediaType};base64,${base64}`;
			// Replace slash-prefixed form first (more specific match)
			result = result.split(`/${path}`).join(dataUri);
			// Then replace bare form (in case some references omit the leading slash)
			result = result.split(path).join(dataUri);
		}
		return result;
	}

	/** Resolve a cover-image path from frontmatter against the blob map.
	 *  frontmatter cover paths have a leading "/" but blob keys are bare GitHub paths. */
	function resolveCoverPath(path: string, blobs?: Record<string, { base64: string; mediaType: string }>): string {
		if (!path || !blobs) return path;
		const bare = path.replace(/^\/+/, '');
		const blob = blobs[bare] ?? blobs[path];
		if (blob) return `data:${blob.mediaType};base64,${blob.base64}`;
		return path;
	}

	function renderInline(escaped: string): string {
		return escaped
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			.replace(/`([^`]+)`/g, '<code class="pi-code">$1</code>')
			.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="pi-img" />')
			.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
	}

	function buildPreviewHtml(body: string, coverAsset?: AdminAssetUpload, galleryAssets?: AdminAssetUpload[]): string {
		const esc = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		const out: string[] = [];

		// Cover image at top
		if (coverAsset?.contentBase64) {
			out.push(`<img class="pi-cover" src="data:${esc(coverAsset.mediaType)};base64,${coverAsset.contentBase64}" alt="${esc(coverAsset.alt || 'Cover')}" />`);
		}

		// Gallery type: show image grid
		if (galleryAssets && galleryAssets.length > 0) {
			const gridCols = galleryAssets.length === 1 ? 1 : 2;
			out.push(`<div class="pi-gallery-grid" style="grid-template-columns:repeat(${gridCols},1fr)">`);
			if (galleryAssets.length > 1) {
				out.push(`<div class="pi-gallery-badge">${galleryAssets.length} images</div>`);
			}
			for (const img of galleryAssets) {
				out.push(`<div class="pi-gallery-item">`);
				out.push(`<img src="data:${esc(img.mediaType)};base64,${img.contentBase64}" alt="${esc(img.alt || '')}" class="pi-gallery-img" />`);
				if (img.caption) out.push(`<p class="pi-gallery-cap">${esc(img.caption)}</p>`);
				out.push(`</div>`);
			}
			out.push(`</div>`);
			return out.join('');
		}

		// Parse body text
		const lines = body.split('\n');
		let inCode = false;
		let codeLang = '';
		const codeBuf: string[] = [];
		// Custom component block state
		let inComp = false;
		let compTag = '';
		let compAttrs = '';
		const compBuf: string[] = [];

		function flushComp() {
			const inner = compBuf.join('\n');
			if (compTag === 'panel') {
				const typeM = compAttrs.match(/type=["']?(\w+)["']?/);
				const ptype = typeM ? typeM[1] : 'info';
				const colors: Record<string, string> = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', error: '#ef4444' };
				const color = colors[ptype] || colors.info;
				out.push(`<div class="pi-panel" style="border-color:${color}33;background:${color}11"><span class="pi-panel-type" style="color:${color}">${esc(ptype)}</span><div>${renderInline(esc(inner))}</div></div>`);
			} else if (compTag === 'container') {
				out.push(`<div class="pi-container">${renderInline(esc(inner))}</div>`);
			} else if (compTag === 'thought') {
				const authorM = compAttrs.match(/author=["']?([^"'\s>]+)["']?/);
				const author = authorM ? authorM[1] : '';
				out.push(`<blockquote class="pi-thought"><p>${renderInline(esc(inner))}</p>${author ? `<cite>— ${esc(author)}</cite>` : ''}</blockquote>`);
			} else if (compTag === 'grid') {
				const colsM = compAttrs.match(/cols=["']?(\d+)["']?/);
				const cols = colsM ? colsM[1] : '2';
				out.push(`<div class="pi-grid" style="grid-template-columns:repeat(${cols},1fr)">${renderInline(esc(inner))}</div>`);
			} else if (compTag === 'rk-progress') {
				const totalM = compAttrs.match(/total=["']?(\d+)["']?/);
				const currentM = compAttrs.match(/current=["']?(\d+)["']?/);
				const total = totalM ? parseInt(totalM[1]) : 100;
				const current = currentM ? parseInt(currentM[1]) : 0;
				const pct = Math.round(Math.min(100, (current / total) * 100));
				out.push(`<div class="pi-progress"><div class="pi-progress-bar" style="width:${pct}%"></div><span>${pct}%</span></div>`);
			} else {
				out.push(`<div class="pi-comp-block">&lt;${esc(compTag)}&gt; block</div>`);
			}
			compBuf.length = 0;
			inComp = false;
			compTag = '';
			compAttrs = '';
		}

		for (const raw of lines) {
			// Handle open component tags
			if (!inCode && !inComp) {
				const openM = raw.match(/^<(panel|container|thought|grid|rk-progress)(\s[^>]*)?>$/i);
				if (openM) {
					inComp = true;
					compTag = openM[1].toLowerCase();
					compAttrs = openM[2] || '';
					continue;
				}
				// Self-contained chip
				const chipM = raw.match(/^<chip([^>]*)>(.*?)<\/chip>$/i);
				if (chipM) {
					const labelM = chipM[1].match(/label=["']?([^"'>]+)["']?/);
					const iconM = chipM[1].match(/icon=["']?([^"'>]+)["']?/);
					const label = labelM ? labelM[1] : chipM[2];
					const icon = iconM ? iconM[1] : '';
					out.push(`<span class="pi-chip">${icon ? `<span class="pi-chip-icon">${esc(icon)}</span>` : ''}${esc(label)}</span>`);
					continue;
				}
			}

			if (inComp) {
				const closeM = raw.match(new RegExp(`^</${compTag}>$`, 'i'));
				if (closeM) {
					flushComp();
				} else {
					compBuf.push(raw);
				}
				continue;
			}

			if (!inCode) {
				const fence = raw.match(/^```(\w*)/);
				if (fence) {
					inCode = true;
					codeLang = fence[1] || '';
					codeBuf.length = 0;
					continue;
				}
			} else {
				if (raw.trim() === '```') {
					inCode = false;
					if (codeLang === 'chart') {
						out.push(`<div class="pi-comp-block pi-chart-block">Chart Block (Chart.js)</div>`);
					} else if (codeLang === 'mermaid') {
						out.push(`<div class="pi-comp-block pi-mermaid-block">Mermaid Diagram</div>`);
					} else {
						const label = codeLang ? `<span class="pi-lang">${esc(codeLang)}</span>` : '';
						out.push(`<pre class="pi-pre">${label}<code>${esc(codeBuf.join('\n'))}</code></pre>`);
					}
					codeBuf.length = 0;
				} else {
					codeBuf.push(raw);
				}
				continue;
			}

			if (/^::[\w-]+/.test(raw)) {
				out.push(`<div class="pi-directive">${esc(raw)}</div>`);
				continue;
			}
			const h1m = raw.match(/^# (.+)/);
			const h2m = raw.match(/^## (.+)/);
			const h3m = raw.match(/^### (.+)/);
			if (h1m) { out.push(`<h1 class="pi-h1">${renderInline(esc(h1m[1]))}</h1>`); continue; }
			if (h2m) { out.push(`<h2 class="pi-h2">${renderInline(esc(h2m[1]))}</h2>`); continue; }
			if (h3m) { out.push(`<h3 class="pi-h3">${renderInline(esc(h3m[1]))}</h3>`); continue; }
			if (/^---+$/.test(raw.trim())) { out.push('<hr class="pi-hr" />'); continue; }
			if (raw.startsWith('- ') || raw.startsWith('* ')) {
				out.push(`<li class="pi-li">${renderInline(esc(raw.slice(2)))}</li>`);
				continue;
			}
			const numM = raw.match(/^\d+\.\s+(.*)/);
			if (numM) { out.push(`<li class="pi-li pi-oli">${renderInline(esc(numM[1]))}</li>`); continue; }
			if (raw.startsWith('> ')) {
				out.push(`<blockquote class="pi-bq">${renderInline(esc(raw.slice(2)))}</blockquote>`);
				continue;
			}
			if (!raw.trim()) { out.push('<div class="pi-gap"></div>'); continue; }
			out.push(`<p class="pi-p">${renderInline(esc(raw))}</p>`);
		}
		if (inCode && codeBuf.length) {
			out.push(`<pre class="pi-pre"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
		}
		if (inComp && compBuf.length) flushComp();
		return out.join('');
	}

	function buildThoughtsPreviewHtml(): string {
		const form = contentForm;
		const esc = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const dateStr = form.date
			? new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
			: '';
		const tagsHtml = form.tags.map((t) => `<span class="tc-tag">${esc(t)}</span>`).join('');
		return `<div class="tc-thought-card">
			<p class="tc-thought-body">${esc(form.body)}</p>
			<div class="tc-thought-meta">
				<span class="tc-thought-title">${esc(form.title || 'Untitled')}</span>
				${dateStr ? `<span class="tc-thought-date">${esc(dateStr)}</span>` : ''}
				${tagsHtml ? `<div class="tc-thought-tags">${tagsHtml}</div>` : ''}
			</div>
		</div>`;
	}

	const previewHtml = $derived(
		contentForm.type === 'thoughts'
			? buildThoughtsPreviewHtml()
			: contentForm.type === 'gallery'
				? buildPreviewHtml('', undefined, contentAssets)
				: buildPreviewHtml(contentForm.body, contentForm.coverAsset)
	);

	const COMPONENT_GROUPS = [
		{ id: 'directive', label: 'Directive' },
		{ id: 'html', label: 'HTML block' },
		{ id: 'code', label: 'Code' },
		{ id: 'enhancement', label: 'Enhancement' }
	] as const;

	function parseFrontmatterFields(markdown: string): Record<string, string> {
		const match = markdown.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return {};
		const fields: Record<string, string> = {};
		for (const line of match[1].split('\n')) {
			const m = line.match(/^([\w-]+):\s*["']?(.+?)["']?\s*$/);
			if (m) fields[m[1]] = m[2];
		}
		return fields;
	}

	/** Parse YAML list values (e.g. `tags:` with `  - item` lines) from frontmatter. */
	function parseFrontmatterList(markdown: string, key: string): string[] {
		const match = markdown.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return [];
		const results: string[] = [];
		const lines = match[1].split('\n');
		let active = false;
		for (const line of lines) {
			if (active) {
				const itemMatch = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
				if (itemMatch) { results.push(itemMatch[1]); continue; }
				if (/^\S/.test(line)) active = false; // new top-level key ends the list
			}
			if (new RegExp(`^${key}:\\s*$`).test(line)) active = true;
		}
		return results;
	}

	function validateGithubStart(event: SubmitEvent) {
		if (!turnstileReady) {
			event.preventDefault();
			showApiToast('error', 'Turnstile is required for GitHub sign-in, but PUBLIC_TURNSTILE_SITE_KEY is not configured.');
			return;
		}
		if (turnstileRequired && !turnstileToken) {
			event.preventDefault();
			showApiToast('error', 'Wait for Turnstile verification to complete before signing in with GitHub.');
		}
	}

	function isAuthenticationRequired(error: unknown) {
		return error instanceof Error && /Authentication required|401/.test(error.message);
	}

	function readCallbackState(params: URLSearchParams) {
		authError = params.get('auth_error') || params.get('logout_error') || '';
		authNotice = params.get('logout') ? 'Signed out successfully.' : params.get('mockLogin') ? 'Mock sign-in completed.' : '';
		if (authError || authNotice) {
			params.delete('auth_error');
			params.delete('logout_error');
			params.delete('logout');
			params.delete('mockLogin');
			const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
			window.history.replaceState({}, '', next);
			// Route through the toast system so the user always sees the message regardless
			// of scroll position or which panel is currently visible.
			if (authError) showApiToast('error', authError);
			if (authNotice) showApiToast('success', authNotice);
		}
	}

	async function loadWorkerSession() {
		if (!activeWorkerUrl) {
			workerStatus = null;
			adminUser = null;
			return null;
		}
		if (!adminUnlocked || !adminChallenge) {
			adminUser = null;
			return null;
		}
		isLoadingAuth = true;
		try {
			const { user, csrfToken: nextCsrfToken } = await adminClient.me(activeWorkerUrl, adminChallenge);
			adminUser = user;
			csrfToken = nextCsrfToken || '';
			authError = '';
			return user;
		} catch (error) {
			adminUser = null;
			csrfToken = '';
			if (error instanceof Error && /Access denied|403/.test(error.message)) {
				denyAdmin();
				return null;
			}
			if (!isAuthenticationRequired(error)) {
				authError = '';
				showApiError('Unable to load admin session', error, 'We could not load the admin session.');
			}
			return null;
		} finally {
			isLoadingAuth = false;
		}
	}

	// Worker
	async function loadPrs() {
		if (!activeWorkerUrl) return;
		isLoadingPrs = true;
		try {
			const user = adminUser || (await loadWorkerSession());
			if (!workerStatus?.enabled || !user) {
				pullRequests = [];
				prsLoaded = true;
				return;
			}
			const prs = await adminClient.prs(activeWorkerUrl, adminChallenge);
			pullRequests = prs.pullRequests;
			prsLoaded = true;
		} catch (error) {
			pullRequests = [];
			showApiError('Unable to load pull requests', error, 'We could not load pull requests.');
		} finally {
			isLoadingPrs = false;
		}
	}

	function selectTab(tab: 'create' | 'prs') {
		activeTab = tab;
		if (tab === 'prs' && !prsLoaded) void loadPrs();
	}

	async function createContentPrFromForm() {
		if (!activeWorkerUrl) return;
		createResult = '';
		createError = '';
		formError = '';
		if (!adminUser) {
			showApiToast('error', 'Sign in with GitHub before creating a content PR.');
			return;
		}
		if (!contentPayload.title || !contentPayload.slug) {
			formError = 'Title is required.';
			return;
		}
		if (slugExists) {
			formError = 'That slug already exists. Change the slug before creating a PR.';
			return;
		}
		githubError = validateUrl(contentForm.github);
		demoError = validateUrl(contentForm.demo);
		if (githubError || demoError) return;
		isCreatingPr = true;
		try {
			const result = await adminClient.createContentPr(activeWorkerUrl, contentPayload, {
				adminChallenge,
				csrfToken
			});
			showApiToast('success', `Created PR #${result.pullRequest.number}: ${result.pullRequest.url}`);
			createResult = '';
			contentForm = createDefaultContentForm();
			contentAssets = [];
			tagInput = '';
			catInput = '';
			prSearchQuery = '';
			prStatusFilter = 'all';
			prsLoaded = false;
			if (activeTab === 'prs') await loadPrs();
		} catch (error) {
			showApiError('Unable to create content PR', error, 'We could not create the content PR.');
		} finally {
			isCreatingPr = false;
		}
	}

	// Hide the layout sidebar and mobile header while the PR detail modal is open
	$effect(() => {
		document.body.classList.toggle('pr-modal-open', !!activePr);
		return () => document.body.classList.remove('pr-modal-open');
	});

	// Date field native input ref — used to call showPicker() on display click
	let dateInputEl: HTMLInputElement | null = $state(null);

	function openDatePicker() {
		if (!dateInputEl) return;
		try {
			dateInputEl.showPicker();
		} catch {
			// showPicker not supported (older Safari) — fall back to focus
			dateInputEl.focus();
		}
	}

	// Close nav picker on Escape; auto-focus search when opened
	let navPickerSearchEl: HTMLInputElement | null = $state(null);
	$effect(() => {
		if (!navPickerOpen) return;
		navPickerSearch = '';
		// Focus the search input after DOM settles
		requestAnimationFrame(() => navPickerSearchEl?.focus());
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') navPickerOpen = null;
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		isLocalAdminHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
		readCallbackState(params);
		const localWorker = params.get('worker');
		if (localWorker && /^https?:\/\//i.test(localWorker)) {
			const cleaned = localWorker.replace(/\/+$/, '');
			const configuredWorkerUrl = (data.admin.workerUrl || '').replace(/\/+$/, '');
			if (isLocalAdminHost || (configuredWorkerUrl && cleaned === configuredWorkerUrl)) {
				workerUrl = cleaned;
			} else if (configuredWorkerUrl) {
				workerUrl = configuredWorkerUrl;
			}
		} else if (data.admin.workerUrl) {
			workerUrl = data.admin.workerUrl;
		}
		workerStatus = {
			enabled: data.admin.enabled,
			mode: data.admin.enabled ? 'github' : 'disabled',
			reason: data.admin.reason
		};
		const existingChallenge = getAdminChallengeCookie();
		if (existingChallenge) {
			adminChallenge = existingChallenge;
			challengeInput = existingChallenge;
			adminUnlocked = true;
			void loadWorkerSession();
		}
	});
</script>

<svelte:head>
	<title>Admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="admin-page" class:challenge-mode={!adminUnlocked}>
	{#if !adminUnlocked}
		<section class="challenge-panel" aria-labelledby="admin-challenge-title">
			<div class="challenge-mark" aria-hidden="true">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none">
					<path d="M7 10V7.8C7 5.15 9.02 3 12 3s5 2.15 5 4.8V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
					<path d="M6.5 10h11A2.5 2.5 0 0 1 20 12.5v5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-5A2.5 2.5 0 0 1 6.5 10Z" stroke="currentColor" stroke-width="1.8"/>
					<path d="M12 14v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
				</svg>
			</div>
			<div class="challenge-copy">
				<p class="challenge-kicker">Protected workspace</p>
				<h1 id="admin-challenge-title">Admin Challenge</h1>
				<p>Enter the workspace challenge code to unlock admin tools on this device.</p>
			</div>
			<form class="challenge-form" onsubmit={unlockAdmin}>
				<label class="challenge-field">
					<span>Challenge code</span>
					<div class="challenge-input-wrap">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 15h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
							<path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
							<path d="M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/>
						</svg>
						<input
							type="password"
							bind:value={challengeInput}
							autocomplete="current-password"
							placeholder="Enter challenge code"
							aria-describedby="challenge-hint"
						/>
					</div>
				</label>
				<p id="challenge-hint" class="challenge-hint">
					The unlock lasts 24 hours. GitHub sign-in is still required before creating content.
				</p>
				<div class="challenge-actions">
					<button type="submit" class="btn-primary button-reset">Unlock Admin</button>
					<button type="button" class="btn-ghost" onclick={denyAdmin}>Cancel</button>
				</div>
				{#if authError}<p class="feedback-error inline-feedback challenge-feedback">{authError}</p>{/if}
			</form>
		</section>
	{:else}
	<!-- Top bar -->
	<div class="admin-topbar">
		<div class="topbar-title-group">
			<h1>Admin</h1>
			<p class="topbar-subtitle">Content workspace</p>
		</div>
		<div class="topbar-actions">
			{#if workerStatus?.enabled && adminUser}
				<div class="github-user-card" aria-label="Authenticated GitHub account">
					<img
						class="github-user-avatar"
						src={adminUser.avatarUrl || `https://github.com/${adminUser.githubUsername}.png?size=80`}
						alt={`${adminUser.githubUsername} avatar`}
						width="40"
						height="40"
					/>
					<div class="github-user-meta">
						<strong>{resolvedDisplayName}</strong>
						<a class="topbar-link github-user-name" href={adminUser.profileUrl || `https://github.com/${adminUser.githubUsername}`} target="_blank" rel="noreferrer">@{adminUser.githubUsername}</a>
					</div>
					<button type="button" class="topbar-link github-signout-btn" aria-label="Sign out" title="Sign out" onclick={signOut} disabled={isSigningOut}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 3v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path d="M7.05 5.95a8 8 0 1 0 9.9 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</div>
	<div class="topbar-status-row">
		<div class="topbar-status" class:enabled={workerStatus?.enabled} class:loading={isLoadingPrs || isLoadingAuth}>
			<span class="status-dot"></span>
			<span class="status-text">
				{#if isLoadingPrs || isLoadingAuth}
					Connecting to worker
				{:else if workerStatus?.enabled}
					Worker connected
				{:else}
					Worker disconnected
				{/if}
			</span>
		</div>
	</div>

	{#if apiToast}
		<div class:is-closing={isToastClosing} class:toast-error={apiToast.kind === 'error'} class:toast-success={apiToast.kind === 'success'} class="api-toast" role="alert" aria-live="assertive">
			<div class="api-toast-icon" aria-hidden="true">
				{#if apiToast.kind === 'error'}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path d="M12 9v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M12 17h.01" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
						<path d="M10.3 4.8c.8-1.4 2.8-1.4 3.6 0l8 13.9c.8 1.4-.2 3.2-1.8 3.2H4.1c-1.6 0-2.6-1.8-1.8-3.2l8-13.9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
					</svg>
				{:else}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
				{/if}
			</div>
			<div class="api-toast-copy">
				<strong>{apiToast.kind === 'error' ? 'Action failed' : 'Notice'}</strong>
				<p>{apiToast.message}</p>
			</div>
			<button type="button" class="api-toast-dismiss" onclick={dismissApiToast} aria-label="Dismiss message">×</button>
		</div>
	{/if}

	<div class="admin-tabs" role="tablist" aria-label="Admin workspace">
		<button
			type="button"
			role="tab"
			class:active={activeTab === 'create'}
			aria-selected={activeTab === 'create'}
			onclick={() => selectTab('create')}
		>
			Create Post
		</button>
		<button
			type="button"
			role="tab"
			class:active={activeTab === 'prs'}
			aria-selected={activeTab === 'prs'}
			onclick={() => selectTab('prs')}
		>
			Pull Requests
			{#if pullRequests.length}<span>{pullRequests.length}</span>{/if}
		</button>
	</div>

	{#if activeTab === 'prs'}
	<section class="admin-card pr-section">
		<h2>Pull Requests</h2>
		{#if isLoadingPrs || isLoadingAuth}
			<p class="muted">Loading...</p>
		{:else if !workerStatus?.enabled}
			<p class="muted">Worker not reachable — start the dev server at <code>{workerUrl}</code>.</p>
		{:else if authError}
			<p class="feedback-error inline-feedback">{authError}</p>
		{:else if !adminUser}
			<div class="auth-panel">
				<p class="muted">Sign in with GitHub to view open pull requests and create content PRs.</p>
				{#if loginUrl}
					<form method="post" action={loginUrl} onsubmit={validateGithubStart}>
						<input type="hidden" name="adminChallenge" value={adminChallenge} />
						<input type="hidden" name="turnstileToken" value={turnstileToken} />
						{#if effectiveTurnstileSiteKey}
							<div class="turnstile-slot" use:renderTurnstile></div>
						{/if}
						{#if !turnstileReady}
							<p class="feedback-error inline-feedback">Turnstile is required, but PUBLIC_TURNSTILE_SITE_KEY is not configured.</p>
						{:else if turnstileStatus === 'error'}
							<p class="feedback-error inline-feedback">Turnstile could not load. Refresh the page and try again.</p>
						{/if}
						<button type="submit" class="btn-github btn-github-lg auth-link" disabled={githubSignInDisabled}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
					Sign in with GitHub
						</button>
					</form>
				{/if}
			</div>
		{:else if pullRequests.length === 0}
			<p class="muted">No open pull requests.</p>
		{:else}
			<!-- Search + filter bar -->
			<div class="pr-filter-bar">
				<input
					class="pr-search"
					type="search"
					placeholder="Search pull requests..."
					bind:value={prSearchQuery}
				/>
				<select
					class="pr-status-select"
					bind:value={prStatusFilter}
					aria-label="Filter by status"
				>
					<option value="all">All statuses</option>
					<option value="open">Open</option>
					<option value="needs_works">Needs Work</option>
					<option value="approved">Approved</option>
				</select>
			</div>
			<div class="pr-list">
				{#each filteredPullRequests as pr}
					<button type="button" class="pr-card" onclick={() => loadPrDetail(pr)}>
						<div class="pr-card-top">
							<span
								class="pr-badge"
								class:pr-badge-draft={pr.draft}
								class:pr-badge-approved={!pr.draft && pr.reviewStatus === 'approved'}
								class:pr-badge-changes={!pr.draft && pr.reviewStatus === 'changes_requested'}
								class:pr-badge-open={!pr.draft && pr.reviewStatus !== 'approved' && pr.reviewStatus !== 'changes_requested'}
							>
								{pr.draft ? 'Draft' : pr.reviewStatus === 'approved' ? 'Approved' : pr.reviewStatus === 'changes_requested' ? 'Needs Work' : 'Open'}
							</span>
							<strong>#{pr.number} {pr.title}</strong>
						</div>
						<span>{pr.branch} · @{pr.author}</span>
					</button>
				{/each}
				{#if filteredPullRequests.length === 0}
					<p class="muted">No pull requests match your filter.</p>
				{/if}
			</div>
		{/if}
	</section>
	{/if}

	<!-- New content form -->
	{#if activeTab === 'create'}
	<section class="admin-card">
		<h2>New Content</h2>
		{#if !workerStatus?.enabled}
			<p class="muted">Start the admin worker first. The form stays locked until the worker is reachable.</p>
		{:else if authError}
			<p class="feedback-error inline-feedback">{authError}</p>
		{:else if !adminUser}
			<div class="auth-panel">
				<p class="muted">This admin UI now requires a worker-backed GitHub session before the editor is available.</p>
				{#if loginUrl}
					<form method="post" action={loginUrl} onsubmit={validateGithubStart}>
						<input type="hidden" name="adminChallenge" value={adminChallenge} />
						<input type="hidden" name="turnstileToken" value={turnstileToken} />
						{#if effectiveTurnstileSiteKey}
							<div class="turnstile-slot" use:renderTurnstile></div>
						{/if}
						{#if !turnstileReady}
							<p class="feedback-error inline-feedback">Turnstile is required, but PUBLIC_TURNSTILE_SITE_KEY is not configured.</p>
						{:else if turnstileStatus === 'error'}
							<p class="feedback-error inline-feedback">Turnstile could not load. Refresh the page and try again.</p>
						{/if}
						<button type="submit" class="btn-github btn-github-lg auth-link" disabled={githubSignInDisabled}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
					Continue with GitHub
						</button>
					</form>
				{/if}
			</div>
		{:else}
		<form class="content-form" onsubmit={(e) => e.preventDefault()}>

			<!-- Type + Subtype (blog only) + Title -->
			<div class="form-row" class:form-row-3={contentForm.type === 'blog'}>
				<label>
					<span>Type</span>
					<select value={contentForm.type} onchange={setContentType}>
						{#each data.contentTypes as type}
							<option value={type.id}>{type.label}</option>
						{/each}
					</select>
				</label>
				{#if contentForm.type === 'blog'}
					<label>
						<span>Subtype</span>
						<select bind:value={contentForm.subtype}>
							<option value="article">Article</option>
							<option value="poem">Poem</option>
							<option value="novel">Novel</option>
							<option value="comic">Comic</option>
						</select>
					</label>
				{/if}
				<label>
					<span>Title</span>
					<input value={contentForm.title} oninput={updateTitle} placeholder="New article title" />
				</label>
			</div>

			<!-- Slug preview -->
			{#if currentSlug}
				<div class="slug-preview" class:slug-exists={slugExists}>
					<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M9.5 3H13a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1h3.5M6 1h4a1 1 0 010 2H6a1 1 0 010-2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<code>{contentForm.type}/{currentSlug}</code>
					{#if slugExists}<span class="slug-warn">⚠ already exists</span>{/if}
				</div>
			{/if}

			<label class="full" class:field-error={slugExists}>
				<span>Slug</span>
				<input
					value={contentForm.slug}
					oninput={updateSlug}
					placeholder="auto-generated-from-title"
					autocomplete="off"
				/>
				{#if slugExists}<span class="input-error">This slug already exists in the current content metadata.</span>{/if}
			</label>

			<!-- Date + Summary -->
			<div class="form-row">
				<label>
					<span>Date</span>
					<div class="date-field-wrap">
						<!-- Clickable display layer — calls showPicker() on the hidden native input -->
						<div
							class="date-display"
							role="button"
							tabindex="0"
							onclick={openDatePicker}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDatePicker(); } }}
						>
							<svg class="date-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
							<span>{contentForm.date ? new Date(contentForm.date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pick a date'}</span>
						</div>
						<!-- Hidden native input — in DOM for showPicker(), not interactive -->
						<input bind:this={dateInputEl} class="date-input-native" type="date" bind:value={contentForm.date} tabindex="-1" aria-hidden="true" />
					</div>
				</label>
				<label>
					<span>Summary</span>
					<input bind:value={contentForm.summary} placeholder="Short description for metadata" />
				</label>
			</div>

			<!-- Tags chip selector -->
			<div class="field-group full">
				<span class="field-label">Tags</span>
				<div class="chip-field">
					{#each contentForm.tags as tag}
						<span class="chip">
							{tag}
							<button
								type="button"
								class="chip-remove"
								onclick={(e) => { e.stopPropagation(); removeTag(tag); }}
								aria-label="Remove tag {tag}"
							>×</button>
						</span>
					{/each}
					<input
						bind:this={tagInputEl}
						bind:value={tagInput}
						class="chip-input"
						placeholder={contentForm.tags.length ? '' : 'Type or pick tags...'}
						onfocus={() => (tagDropdownOpen = true)}
						onblur={() => setTimeout(() => (tagDropdownOpen = false), 160)}
						onkeydown={handleTagKeydown}
						autocomplete="off"
					/>
				</div>
				{#if tagDropdownOpen && filteredTags.length}
					<div class="chip-dropdown">
						{#each filteredTags as tag}
							<button type="button" class="chip-option" onmousedown={(e) => { e.preventDefault(); addTag(tag); }}>
								{tag}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Category chip selector (single) -->
			<div class="field-group full">
				<span class="field-label">Category</span>
				<div class="chip-field">
					{#if contentForm.category}
						<span class="chip chip-cat">
							{contentForm.category}
							<button
								type="button"
								class="chip-remove"
								onclick={(e) => { e.stopPropagation(); clearCategory(); }}
								aria-label="Remove category"
							>×</button>
						</span>
					{/if}
					{#if !contentForm.category}
						<input
							bind:this={catInputEl}
							bind:value={catInput}
							class="chip-input"
							placeholder="Pick or type a category..."
							onfocus={() => (catDropdownOpen = true)}
							onblur={() => setTimeout(() => (catDropdownOpen = false), 160)}
							onkeydown={handleCatKeydown}
							autocomplete="off"
						/>
					{/if}
				</div>
				{#if catDropdownOpen && filteredCats.length}
					<div class="chip-dropdown">
						{#each filteredCats as cat}
							<button type="button" class="chip-option" onmousedown={(e) => { e.preventDefault(); selectCategory(cat); }}>
								{cat}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Portfolio fields -->
			{#if contentForm.type === 'portfolio'}
				<div class="form-row">
					<!-- Status dropdown -->
					<div class="field-group">
						<span class="field-label">Status</span>
						<div class="status-select-wrapper">
							{#if currentStatus.color}
								<span class="status-dot-inline" style="background:{currentStatus.color}"></span>
							{/if}
							<select
								bind:value={contentForm.status}
								class="status-select"
								class:has-status={!!currentStatus.color}
							>
								{#each PORTFOLIO_STATUSES as s}
									<option value={s.value}>{s.label}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- GitHub URL -->
					<label class:field-error={githubError}>
						<span>GitHub URL</span>
						<input
							bind:value={contentForm.github}
							placeholder="https://github.com/..."
							onblur={() => (githubError = validateUrl(contentForm.github))}
							oninput={() => (githubError = '')}
						/>
						{#if githubError}<span class="input-error">{githubError}</span>{/if}
					</label>
				</div>

				<!-- Demo URL -->
				<label class="full" class:field-error={demoError}>
					<span>Demo URL</span>
					<input
						bind:value={contentForm.demo}
						placeholder="https://..."
						onblur={() => (demoError = validateUrl(contentForm.demo))}
						oninput={() => (demoError = '')}
					/>
					{#if demoError}<span class="input-error">{demoError}</span>{/if}
				</label>
			{/if}

			<!-- Cover image (blog article, portfolio, pages) -->
			{#if data.admin.features.allowAssetUpload && showCoverField}
				<div class="cover-field full">
					<span class="field-label">Cover Image</span>
					{#if contentForm.coverAsset}
						<div class="cover-preview">
							<img
								src={`data:${contentForm.coverAsset.mediaType};base64,${contentForm.coverAsset.contentBase64}`}
								alt={contentForm.coverAsset.alt || 'Cover'}
							/>
							<div class="cover-preview-meta">
								<label>
									<span>Alt text</span>
									<input
										value={contentForm.coverAsset.alt || ''}
										oninput={(e) => {
											if (contentForm.coverAsset) contentForm.coverAsset = { ...contentForm.coverAsset, alt: (e.currentTarget as HTMLInputElement).value };
										}}
										placeholder="Accessible description"
									/>
								</label>
								<button type="button" class="btn-ghost" onclick={removeCover}>Remove</button>
							</div>
						</div>
					{:else}
						<input type="file" accept="image/*" onchange={addCoverFile} />
					{/if}
				</div>
			{/if}

			<!-- Body editor -->
			<!-- Hidden file input for inline image insertion -->
			<input bind:this={inlineImageInputEl} type="file" accept="image/*" style="display:none" onchange={addInlineImageFile} />

			<div class="body-editor full">
				<div class="body-editor-header">
					<div class="body-tab-group" role="tablist">
						<button
							type="button"
							role="tab"
							class:active={bodyTabMode === 'write'}
							aria-selected={bodyTabMode === 'write'}
							onclick={() => (bodyTabMode = 'write')}
						>Write</button>
						<button
							type="button"
							role="tab"
							class:active={bodyTabMode === 'preview'}
							aria-selected={bodyTabMode === 'preview'}
							onclick={() => (bodyTabMode = 'preview')}
						>Preview</button>
					</div>
					{#if data.admin.features.allowCustomComponents && filteredComponents.length > 0 && contentForm.type !== 'gallery'}
						<button
							type="button"
							class="toolbar-toggle"
							class:active={showComponentToolbar}
							onclick={() => (showComponentToolbar = !showComponentToolbar)}
							title="Insert component"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
								<rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
								<rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
								<rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
							</svg>
							Components
						</button>
					{/if}
				</div>

				<!-- Formatting toolbar (Section A) — always shown in write mode for non-gallery -->
				{#if bodyTabMode === 'write' && contentForm.type !== 'gallery'}
					<div class="fmt-toolbar">
						<button type="button" class="fmt-btn" title="Bold" onclick={fmtBold}><strong>B</strong></button>
						<button type="button" class="fmt-btn" title="Italic" onclick={fmtItalic}><em>I</em></button>
						<button type="button" class="fmt-btn" title="Strikethrough" onclick={fmtStrike}><s>S</s></button>
						<span class="fmt-sep"></span>
						<button type="button" class="fmt-btn" title="Heading 1" onclick={fmtH1}>H1</button>
						<button type="button" class="fmt-btn" title="Heading 2" onclick={fmtH2}>H2</button>
						<button type="button" class="fmt-btn" title="Heading 3" onclick={fmtH3}>H3</button>
						<span class="fmt-sep"></span>
						<button type="button" class="fmt-btn" title="Bullet list" onclick={fmtBullet}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="7" r="2" fill="currentColor"/><line x1="10" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="12" r="2" fill="currentColor"/><line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="17" r="2" fill="currentColor"/><line x1="10" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="2"/></svg>
						</button>
						<button type="button" class="fmt-btn" title="Numbered list" onclick={fmtNumbered}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><text x="2" y="9" font-size="8" fill="currentColor">1.</text><text x="2" y="15" font-size="8" fill="currentColor">2.</text><text x="2" y="21" font-size="8" fill="currentColor">3.</text><line x1="11" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2"/><line x1="11" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/><line x1="11" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="2"/></svg>
						</button>
						<button type="button" class="fmt-btn" title="Blockquote" onclick={fmtBlockquote}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 7h4v4H3v4l4-4h3V3H3v4zM13 7h4v4h-4v4l4-4h3V3h-7v4z" fill="currentColor"/></svg>
						</button>
						<button type="button" class="fmt-btn" title="Code block" onclick={fmtCode}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
						<button type="button" class="fmt-btn" title="Horizontal rule" onclick={fmtHr}>&#8212;</button>
						<span class="fmt-sep"></span>
						<button type="button" class="fmt-btn" title="Inline image" onclick={fmtInlineImage}>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
							<span>Img</span>
						</button>
					</div>
				{/if}

				<!-- Components toolbar (Section B) -->
				{#if showComponentToolbar && data.admin.features.allowCustomComponents && filteredComponents.length > 0}
					<div class="component-toolbar">
						{#each COMPONENT_GROUPS as group}
							{@const items = filteredComponents.filter((c) => c.group === group.id)}
							{#if items.length}
								<div class="toolbar-group">
									<span class="toolbar-group-label">{group.label}</span>
									<div class="toolbar-btns">
										{#each items as comp}
											<button
												type="button"
												class="toolbar-btn"
												title={comp.description + '\n\nPreview: ' + comp.preview}
												onclick={() => insertSnippet(comp.snippet)}
											>{comp.label}</button>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				{#if bodyTabMode === 'write'}
					<textarea
						bind:this={bodyTextareaEl}
						bind:value={contentForm.body}
						rows="16"
						class="body-textarea"
						placeholder={contentForm.type === 'gallery'
							? 'Gallery entries use image frontmatter. Body is optional.'
							: 'Write markdown content here.'}
					></textarea>
				{:else}
					<div class="body-preview" aria-label="Markdown preview">
						{#if contentForm.body.trim()}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html previewHtml}
						{:else}
							<p class="preview-empty">Nothing to preview yet.</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Gallery: multi-image upload -->
			{#if data.admin.features.allowAssetUpload && contentForm.type === 'gallery'}
				<label class="full">
					<span>Images</span>
					<input type="file" accept="image/*" multiple onchange={addAssetFiles} />
				</label>
			{/if}

			{#if contentAssets.length && (contentForm.type === 'gallery')}
				<div class="asset-list full">
					{#each contentAssets as asset}
						<div class="asset-row">
							<img
								src={`data:${asset.mediaType};base64,${asset.contentBase64}`}
								alt={asset.alt || asset.path}
								loading="lazy"
							/>
							<div class="asset-row-main">
								<div class="asset-row-meta">
									<strong>{asset.path}</strong>
									<span>{asset.mediaType}</span>
								</div>
								<div class="asset-row-fields">
									<label>
										<span>Alt</span>
										<input
											value={asset.alt || ''}
											oninput={(event) => updateAssetField(asset.path, 'alt', (event.currentTarget as HTMLInputElement).value)}
											placeholder="Accessible description"
										/>
									</label>
									<label>
										<span>Caption</span>
										<input
											value={asset.caption || ''}
											oninput={(event) => updateAssetField(asset.path, 'caption', (event.currentTarget as HTMLInputElement).value)}
											placeholder="Displayed caption"
										/>
									</label>
								</div>
							</div>
							<button type="button" class="btn-ghost" onclick={() => removeAsset(asset.path)}>Remove</button>
						</div>
					{/each}
				</div>
			{:else if !data.admin.features.allowAssetUpload}
				<p class="muted full">Asset uploads are disabled by admin config.</p>
			{/if}

			<!-- Prev / next navigation (blog and pages only) -->
			{#if showPrevNextField}
				<div class="form-row prev-next-row full">
					<!-- Previous page trigger -->
					<div class="nav-field-wrap">
						<span class="field-label">Previous Page</span>
						{#if contentForm.prevPage}
							<div class="nav-selected-chip">
								<div class="nav-chip-info">
									<span class="nav-chip-title">{contentForm.prevPage.title}</span>
									<code class="nav-chip-slug">{contentForm.prevPage.slug}</code>
								</div>
								<button type="button" class="nav-chip-remove" onclick={() => (contentForm.prevPage = null)} aria-label="Remove previous page">×</button>
							</div>
						{:else}
							<button type="button" class="nav-pick-trigger" onclick={() => (navPickerOpen = 'prev')}>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
								Search &amp; select…
							</button>
						{/if}
					</div>

					<!-- Next page trigger -->
					<div class="nav-field-wrap">
						<span class="field-label">Next Page</span>
						{#if contentForm.nextPage}
							<div class="nav-selected-chip">
								<div class="nav-chip-info">
									<span class="nav-chip-title">{contentForm.nextPage.title}</span>
									<code class="nav-chip-slug">{contentForm.nextPage.slug}</code>
								</div>
								<button type="button" class="nav-chip-remove" onclick={() => (contentForm.nextPage = null)} aria-label="Remove next page">×</button>
							</div>
						{:else}
							<button type="button" class="nav-pick-trigger" onclick={() => (navPickerOpen = 'next')}>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
								Search &amp; select…
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<div class="form-footer full">
				<button
					type="button"
					class="btn-primary button-reset"
					onclick={createContentPrFromForm}
					disabled={!workerStatus?.enabled || isCreatingPr}
				>
					{isCreatingPr ? 'Creating...' : 'Create Content PR'}
				</button>
			</div>

			{#if formError}<p class="feedback-error full">{formError}</p>{/if}
		</form>
		{/if}
	</section>
	{/if}
	{/if}

	<!-- PR Detail Modal — centered popup -->
	{#if activePr}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="pr-modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) closePrDetail(); }}>
			<div class="pr-modal" role="dialog" aria-modal="true" aria-label="PR detail: {activePr.title}">
				<!-- Solid top bar — close + title only -->
				<div class="pr-modal-topbar">
					<button type="button" class="pr-drawer-close" onclick={closePrDetail} aria-label="Close">
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
							<path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</button>
					<span class="pr-topbar-num">#{activePr.number}</span>
					<span class="pr-drawer-title">{activePr.title}</span>
				</div>

				{#if isLoadingPrDetail}
					<div class="pr-drawer-loading">
						<svg class="pr-loading-spinner" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
							<circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="50 20" opacity="0.25"/>
							<circle cx="14" cy="14" r="11" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="20 50"/>
						</svg>
						<p class="muted">Loading preview…</p>
					</div>
				{:else if prDetailError}
					<!-- Fix 4: error / unrenderable fallback -->
					<div class="pr-modal-body">
						<div class="pr-preview-error">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							<p class="pr-preview-error-msg">{prDetailError}</p>
							<p class="pr-preview-error-sub">Preview is unavailable for this PR. Open it directly on GitHub to review the changes.</p>
							<a class="pr-drawer-github pr-error-github" href={activePr.url} target="_blank" rel="noreferrer">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
								View on GitHub
							</a>
						</div>
					</div>
				{:else if prDetail}
					{@const fm = parseFrontmatterFields(prDetail.contentMarkdown)}
					{@const fmTags = parseFrontmatterList(prDetail.contentMarkdown, 'tags')}
					{@const mdBody = injectBlobsIntoText(prDetail.contentMarkdown.replace(/^---[\s\S]*?---\s*/m, ''), prDetail.blobs ?? {})}
					{@const prCover = resolveCoverPath(fm.cover || fm.image || '', prDetail.blobs)}
					<div class="pr-modal-body">
						<!-- Blobs-skipped warning -->
						{#if prDetail.blobsSkipped}
							<div class="pr-blobs-warning">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
								Some images could not be loaded in preview — too many assets. <a href={activePr.url} target="_blank" rel="noreferrer">View on GitHub</a> for the full diff.
							</div>
						{/if}

						<!-- PR info block: status + author/date/branch + GitHub link -->
						<div class="pr-info-block">
							<!-- Top row: badges + GitHub button -->
							<div class="pr-info-top">
								<div class="pr-info-left">
									<span
										class="pr-badge"
										class:pr-badge-draft={prDetail.pr.draft}
										class:pr-badge-approved={!prDetail.pr.draft && prDetail.reviewStatus === 'approved'}
										class:pr-badge-changes={!prDetail.pr.draft && prDetail.reviewStatus === 'changes_requested'}
										class:pr-badge-open={!prDetail.pr.draft && prDetail.reviewStatus === 'pending'}
									>
										{prDetail.pr.draft ? 'Draft' : prDetail.reviewStatus === 'approved' ? 'Approved' : prDetail.reviewStatus === 'changes_requested' ? 'Needs Work' : 'Open'}
									</span>
									<span class="pr-review-status"
										class:review-approved={prDetail.reviewStatus === 'approved'}
										class:review-changes={prDetail.reviewStatus === 'changes_requested'}
										class:review-pending={prDetail.reviewStatus === 'pending'}
									>
										{prDetail.reviewStatus === 'approved' ? '✓ Approved' : prDetail.reviewStatus === 'changes_requested' ? '✗ Changes requested' : '○ Pending review'}
									</span>
								</div>
								<a class="pr-drawer-github" href={prDetail.pr.url} target="_blank" rel="noreferrer">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
									View on GitHub
								</a>
							</div>
							<!-- Bottom row: author/date + branch -->
							<div class="pr-info-details">
								<span class="pr-info-author-date">
									<strong>@{prDetail.pr.author}</strong>
									<span class="pr-info-sep">·</span>
									<time>{new Date(prDetail.pr.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
								</span>
								<span class="pr-info-branch">
									<span class="pr-info-label">branch</span>
									<code class="pr-info-branch-val">{prDetail.pr.branch}</code>
									<button
										type="button"
										class="branch-copy-btn"
										class:branch-copied={branchCopied}
										onclick={() => copyBranch(prDetail!.pr.branch)}
										title={branchCopied ? 'Copied!' : 'Copy branch name'}
										aria-label={branchCopied ? 'Copied!' : 'Copy branch name'}
									>
										{#if branchCopied}
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
										{:else}
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
										{/if}
									</button>
								</span>
							</div>
						</div>

						<!-- Files list (collapsible) -->
						{#if prDetail.files.length}
							<div class="pr-files-wrap">
								<button
									type="button"
									class="pr-files-toggle"
									onclick={() => (prFilesExpanded = !prFilesExpanded)}
									aria-expanded={prFilesExpanded}
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
									<span>{prDetail.files.length} file{prDetail.files.length === 1 ? '' : 's'} changed</span>
									<svg class="pr-files-chevron" class:rotated={prFilesExpanded} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
								</button>
								{#if prFilesExpanded}
									<div class="pr-files">
										{#each prDetail.files as f}
											<div class="pr-file-row">
												<span class="pr-file-role" class:role-content={f.role === 'content'} class:role-asset={f.role === 'asset'}>{f.role}</span>
												<code class="pr-file-path">{f.path}</code>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Content preview — post-like layout -->
						{#if prDetail.contentMarkdown}
							<div class="pr-post-preview">
								{#if prCover}
									<img src={prCover} alt={fm.title || 'Cover'} class="pr-post-cover" />
								{/if}
								<div class="pr-post-body">
									<header class="pr-post-header">
										<h1 class="pr-post-title">{fm.title || prDetail.pr.title}</h1>
										<div class="pr-post-meta">
											{#if fm.date}<time class="pr-post-date">{fm.date}</time>{/if}
											{#if fm.category}<span class="pr-post-category">{fm.category}</span>{/if}
										</div>
										{#if fmTags.length}
											<div class="pr-post-tags">
												{#each fmTags as tag}
													<span class="pr-post-tag">{tag}</span>
												{/each}
											</div>
										{/if}
										{#if fm.summary}
											<p class="pr-post-summary">{fm.summary}</p>
										{/if}
									</header>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html buildPreviewHtml(mdBody)}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Nav picker popup — prev/next page search -->
	{#if navPickerOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="nav-picker-overlay" onclick={(e) => { if (e.target === e.currentTarget) navPickerOpen = null; }}>
			<div class="nav-picker-modal" role="dialog" aria-modal="true" aria-label={navPickerOpen === 'prev' ? 'Select previous page' : 'Select next page'}>
				<div class="nav-picker-header">
					<span class="nav-picker-title">
						{navPickerOpen === 'prev' ? 'Select Previous Page' : 'Select Next Page'}
					</span>
					<button type="button" class="pr-drawer-close" onclick={() => (navPickerOpen = null)} aria-label="Close">
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
							<path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</button>
				</div>
				<div class="nav-picker-search-wrap">
					<svg class="nav-picker-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
						<path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
					<input
						bind:this={navPickerSearchEl}
						type="text"
						class="nav-picker-input"
						placeholder="Search by title or slug…"
						bind:value={navPickerSearch}
						autocomplete="off"
					/>
					{#if navPickerSearch}
						<button type="button" class="nav-picker-clear" onclick={() => (navPickerSearch = '')} aria-label="Clear">×</button>
					{/if}
				</div>
				<div class="nav-picker-list" role="listbox">
					{#if navPickerItems.length === 0}
						<div class="nav-picker-empty">
							{#if navItemsForType.length === 0}
								<p>No published {contentForm.type === 'blog' ? 'blog posts' : 'pages'} found.</p>
								<p class="nav-picker-empty-sub">Publish some content first, then come back to link navigation.</p>
							{:else}
								<p>No results for "<strong>{navPickerSearch}</strong>"</p>
							{/if}
						</div>
					{:else}
						{#each navPickerItems as item}
							<button
								type="button"
								class="nav-picker-item"
								role="option"
								aria-selected={navPickerOpen === 'prev'
									? contentForm.prevPage?.slug === item.slug
									: contentForm.nextPage?.slug === item.slug}
								onclick={() => {
									if (navPickerOpen === 'prev') contentForm.prevPage = { title: item.title, slug: item.slug, section: item.section };
									else contentForm.nextPage = { title: item.title, slug: item.slug, section: item.section };
									navPickerOpen = null;
								}}
							>
								<span class="nav-picker-item-title">{item.title}</span>
								<code class="nav-picker-item-slug">{item.slug}</code>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	/* ── Page shell ──────────────────────────────────────────── */
	.admin-page {
		display: grid;
		gap: 14px;
	}

	.admin-page.challenge-mode {
		min-height: min(720px, calc(100vh - 160px));
		place-items: center;
		padding: 36px 14px;
	}

	/* ── Top bar ─────────────────────────────────────────────── */
	.admin-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 2px;
	}

	.topbar-title-group {
		display: grid;
		gap: 4px;
	}

	.topbar-subtitle {
		margin: 0;
		font-size: 12px;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.admin-topbar h1 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
	}

	.topbar-status-row {
		display: flex;
		justify-content: flex-start;
		padding-bottom: 6px;
	}

	.topbar-status {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--text-secondary);
		font-size: 13px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		padding: 6px 10px;
		border-radius: 999px;
		font-weight: 600;
	}

	.status-text {
		line-height: 1;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--text-tertiary);
		flex-shrink: 0;
		transition: background 0.25s;
	}

	.topbar-status.loading .status-dot {
		background: var(--orange);
	}

	.topbar-status.enabled .status-dot {
		background: var(--green);
	}

	.admin-tabs {
		display: inline-flex;
		width: fit-content;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: var(--bg-glass);
	}

	.admin-tabs button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-height: 34px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.admin-tabs button:hover,
	.admin-tabs button.active {
		background: var(--accent-subtle);
		color: var(--text-primary);
	}

	.admin-tabs span {
		min-width: 20px;
		padding: 2px 6px;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-size: 11px;
		line-height: 1.2;
	}

	.github-user-card {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px 6px 6px;
		border-radius: 999px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
	}

	.github-user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 999px;
		object-fit: cover;
		border: 1px solid var(--border-glass);
		background: var(--bg-card);
		flex-shrink: 0;
	}

	.github-user-meta {
		display: grid;
		gap: 2px;
		line-height: 1.1;
		margin-right: 2px;
	}

	.github-user-meta strong {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.github-user-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.github-signout-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 999px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-secondary);
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}

	button.github-signout-btn {
		padding: 0;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
	}

	.github-signout-btn:hover {
		background: var(--bg-hover);
		border-color: var(--accent-border);
		color: var(--text-primary);
	}

	/* ── Cards ───────────────────────────────────────────────── */
	.admin-card {
		border: 1px solid var(--border-glass);
		background: var(--bg-card);
		box-shadow: 0 2px 12px var(--shadow-color, rgba(0,0,0,0.18));
		backdrop-filter: blur(18px);
		border-radius: var(--radius-xl);
		padding: 22px 24px;
	}

	.admin-card h2 {
		color: var(--text-primary);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 16px;
	}

	.challenge-panel {
		position: relative;
		display: grid;
		gap: 22px;
		width: min(560px, 100%);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--border-glass) 80%, white 10%);
		border-radius: 28px;
		background:
			linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 94%, white 6%), color-mix(in srgb, var(--bg-card) 82%, black 18%)),
			var(--bg-card);
		box-shadow:
			0 28px 90px color-mix(in srgb, var(--shadow-color, rgba(0,0,0,0.32)) 78%, transparent),
			inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
		backdrop-filter: blur(24px) saturate(140%);
		padding: clamp(26px, 5vw, 42px);
	}

	.challenge-panel::before {
		content: '';
		position: absolute;
		inset: -30% auto auto -20%;
		width: 320px;
		height: 320px;
		border-radius: 999px;
		background: radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent) 0%, transparent 68%);
		pointer-events: none;
	}

	.challenge-panel::after {
		content: '';
		position: absolute;
		inset: auto -18% -38% auto;
		width: 300px;
		height: 300px;
		border-radius: 999px;
		background: radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%);
		pointer-events: none;
	}

	.challenge-mark,
	.challenge-copy,
	.challenge-form {
		position: relative;
		z-index: 1;
	}

	.challenge-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 54px;
		height: 54px;
		border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
		border-radius: 18px;
		background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 70%, black 18%));
		color: white;
		box-shadow: 0 18px 45px color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.challenge-copy {
		display: grid;
		gap: 10px;
		max-width: 470px;
	}

	.challenge-kicker {
		margin: 0;
		color: var(--accent);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.challenge-copy h1 {
		margin: 0;
		color: var(--text-primary);
		font-size: clamp(30px, 5vw, 44px);
		font-weight: 800;
		line-height: 1.05;
	}

	.challenge-copy p:not(.challenge-kicker) {
		margin: 0;
		color: var(--text-secondary);
		font-size: 15px;
		line-height: 1.65;
	}

	.challenge-form {
		display: grid;
		gap: 14px;
	}

	.challenge-field {
		display: grid;
		gap: 9px;
	}

	.challenge-field > span {
		color: var(--text-tertiary);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.challenge-input-wrap {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 58px;
		border: 1px solid var(--border-color);
		border-radius: 18px;
		background: color-mix(in srgb, var(--bg-glass) 88%, transparent);
		padding: 0 16px;
		color: var(--text-tertiary);
		transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
	}

	.challenge-input-wrap:focus-within {
		border-color: var(--accent-border);
		background: color-mix(in srgb, var(--bg-glass) 94%, var(--accent) 6%);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent);
	}

	.challenge-input-wrap input {
		width: 100%;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		font-size: 16px;
		outline: none;
	}

	.challenge-input-wrap input::placeholder {
		color: var(--text-tertiary);
	}

	.challenge-hint {
		margin: -2px 0 2px;
		color: var(--text-tertiary);
		font-size: 12px;
		line-height: 1.55;
	}

	.challenge-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 4px;
	}

	.challenge-actions .btn-primary {
		min-height: 48px;
		border-radius: 16px;
		padding-inline: 24px;
		box-shadow: 0 14px 34px color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.challenge-actions .btn-ghost {
		min-height: 48px;
		border-radius: 16px;
		padding-inline: 18px;
		background: color-mix(in srgb, var(--bg-glass) 70%, transparent);
		font-size: 14px;
	}

	.challenge-feedback {
		width: 100%;
		margin-top: 4px;
	}

	.muted {
		color: var(--text-tertiary);
		font-size: 13px;
		margin: 0;
		line-height: 1.6;
	}

	.muted code {
		font-size: 12px;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 1px 5px;
	}

	/* ── PR list ─────────────────────────────────────────────── */
	.pr-list {
		display: grid;
		gap: 6px;
	}

	.auth-panel {
		display: grid;
		gap: 12px;
		justify-items: flex-start;
	}

	.turnstile-slot {
		min-height: 65px;
	}

	/* ── Content form ────────────────────────────────────────── */
	.content-form {
		display: grid;
		gap: 13px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.content-form label,
	.field-group {
		display: grid;
		gap: 6px;
	}

	.content-form label > span:first-child,
	.field-label {
		color: var(--text-tertiary);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.full {
		grid-column: 1 / -1;
	}

	.content-form input,
	.content-form select,
	.content-form textarea {
		width: 100%;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-primary);
		padding: 9px 12px;
		font: inherit;
		font-size: 14px;
		transition: border-color 0.15s;
	}

	.content-form input:focus,
	.content-form select:focus,
	.content-form textarea:focus {
		outline: none;
		border-color: var(--accent-border);
	}

	.content-form textarea {
		resize: vertical;
		line-height: 1.55;
	}

	.field-error input {
		border-color: color-mix(in srgb, var(--red) 50%, transparent);
	}

	.input-error {
		color: var(--red);
		font-size: 11px;
		font-weight: 500;
	}

	/* ── Date field — custom display + showPicker() ─────── */
	.date-field-wrap {
		position: relative;
		display: block;
	}
	/* The styled clickable display */
	.date-display {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-primary);
		padding: 9px 12px;
		font-size: 14px;
		cursor: pointer;
		user-select: none;
		transition: border-color 0.15s, background 0.12s;
	}
	.date-display:hover {
		border-color: var(--accent-border);
		background: color-mix(in srgb, var(--accent) 4%, var(--bg-glass));
	}
	.date-display:focus {
		outline: none;
		border-color: var(--accent-border);
	}
	.date-display span {
		flex: 1;
	}
	.date-icon {
		color: var(--text-tertiary);
		flex-shrink: 0;
	}
	/* Native input — in DOM for showPicker(), visually removed */
	.date-input-native {
		position: absolute;
		width: 0 !important;
		height: 0 !important;
		padding: 0 !important;
		border: none !important;
		background: transparent !important;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}

	/* ── Slug preview ────────────────────────────────────────── */
	.slug-preview {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-tertiary);
		margin-top: -6px;
	}

	.slug-preview code {
		font-size: 11px;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 2px 6px;
	}

	.slug-preview.slug-exists code {
		border-color: color-mix(in srgb, var(--orange) 40%, transparent);
		background: color-mix(in srgb, var(--orange) 8%, transparent);
	}

	.slug-warn {
		font-size: 11px;
		color: var(--orange);
		font-weight: 600;
	}

	/* ── Chip selector ───────────────────────────────────────── */
	.chip-field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		min-height: 42px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		padding: 6px 10px;
		cursor: text;
		transition: border-color 0.15s;
	}

	.chip-field:focus-within {
		border-color: var(--accent-border);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px 3px 10px;
		border-radius: 999px;
		background: var(--accent-subtle);
		border: 1px solid var(--accent-border);
		color: var(--text-primary);
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;
	}

	.chip-cat {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.28);
	}

	.chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		border-radius: 999px;
		border: 0;
		background: transparent;
		color: var(--text-tertiary);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.chip-remove:hover {
		color: var(--text-primary);
	}

	.chip-input {
		flex: 1;
		min-width: 90px;
		border: 0 !important;
		background: transparent !important;
		padding: 2px 2px !important;
		font-size: 13px !important;
		color: var(--text-primary);
		outline: none;
		box-shadow: none !important;
	}

	.chip-dropdown {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		padding: 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-card);
		box-shadow: var(--shadow-glass);
	}

	.chip-option {
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 0.12s, color 0.12s;
	}

	.chip-option:hover {
		border-color: var(--accent-border);
		color: var(--text-primary);
	}

	/* ── Status dropdown ─────────────────────────────────────── */
	.status-select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.status-dot-inline {
		position: absolute;
		left: 11px;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		pointer-events: none;
		flex-shrink: 0;
		z-index: 1;
	}

	.status-select.has-status {
		padding-left: 28px !important;
	}

	/* ── Buttons ─────────────────────────────────────────────── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		padding: 0 20px;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: white;
		font-weight: 700;
		font-size: 14px;
		white-space: nowrap;
	}

	.button-reset {
		border: 0;
		font: inherit;
		cursor: pointer;
	}

	.button-reset:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.btn-ghost {
		min-height: 30px;
		padding: 0 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: transparent;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.topbar-link,
	.auth-link {
		text-decoration: none;
	}

	/* ── GitHub sign-in buttons ──────────────────────────────── */
	.btn-github {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		min-height: 36px;
		border-radius: 8px;
		background: #24292f;
		color: #fff;
		font-weight: 600;
		font-size: 13px;
		text-decoration: none;
		border: 1px solid rgba(255,255,255,0.12);
		transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
		white-space: nowrap;
	}
	.btn-github:hover {
		background: #32383f;
		box-shadow: 0 0 0 3px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.4);
	}
	.btn-github:disabled {
		cursor: not-allowed;
		opacity: 0.55;
		box-shadow: none;
		transform: none;
	}
	.btn-github:active {
		transform: scale(0.97);
	}
	.btn-github-lg {
		min-height: 46px;
		padding: 0 24px;
		font-size: 15px;
		gap: 10px;
		border-radius: 10px;
		border: 1px solid rgba(255,255,255,0.15);
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
	}
	.btn-github-lg:hover {
		background: #32383f;
		box-shadow: 0 0 0 3px rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.5);
	}
	/* ── GitHub buttons — light mode overrides ───────────────── */
	:global([data-theme="light"]) .btn-github {
		background: #24292f;
		color: #fff;
		border-color: rgba(0,0,0,0.18);
	}
	:global([data-theme="light"]) .btn-github:hover {
		background: #32383f;
		box-shadow: 0 0 0 3px rgba(36,41,47,0.12), 0 2px 8px rgba(0,0,0,0.2);
	}
	:global([data-theme="light"]) .btn-github-lg {
		border-color: rgba(0,0,0,0.2);
		box-shadow: 0 1px 4px rgba(0,0,0,0.12);
	}
	:global([data-theme="light"]) .btn-github-lg:hover {
		box-shadow: 0 0 0 3px rgba(36,41,47,0.1), 0 4px 16px rgba(0,0,0,0.18);
	}

	/* ── Assets ──────────────────────────────────────────────── */
	.asset-list {
		display: grid;
		gap: 10px;
	}

	.asset-row {
		display: grid;
		grid-template-columns: 76px minmax(0, 1fr) auto;
		align-items: start;
		gap: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		border-radius: var(--radius-md);
		padding: 10px;
	}

	.asset-row img {
		width: 76px;
		height: 76px;
		border-radius: 10px;
		object-fit: cover;
		border: 1px solid var(--border-color);
		background: var(--bg-card);
	}

	.asset-row-main,
	.asset-row-meta {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.asset-row strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-primary);
		font-size: 13px;
	}

	.asset-row-meta span {
		color: var(--text-tertiary);
		font-size: 11px;
	}

	.asset-row-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.asset-row-fields label {
		display: grid;
		gap: 4px;
	}

	.asset-row-fields label > span {
		color: var(--text-tertiary);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* ── Form footer ─────────────────────────────────────────── */
	.form-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-top: 4px;
	}

	/* ── Feedback ────────────────────────────────────────────── */
	.feedback-error {
		margin: 0;
		padding: 10px 13px;
		border-radius: var(--radius-md);
		font-size: 13px;
		border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
		background: color-mix(in srgb, var(--red) 8%, transparent);
		color: var(--red);
	}

	.api-toast {
		position: fixed;
		top: 92px;
		right: 20px;
		z-index: 60;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: min(500px, calc(100vw - 40px));
		padding: 15px 16px;
		border-radius: 18px;
		border: 1px solid var(--border-glass);
		background: var(--bg-card);
		backdrop-filter: blur(18px);
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
		color: var(--text-primary);
		animation: api-toast-in 180ms ease-out;
	}

	.api-toast.is-closing {
		animation: api-toast-out 220ms ease-in forwards;
		pointer-events: none;
	}

	.toast-error {
		border-color: color-mix(in srgb, var(--red) 42%, transparent);
		background: color-mix(in srgb, var(--red) 12%, var(--bg-card));
	}

	.toast-error .api-toast-icon {
		background: color-mix(in srgb, var(--red) 18%, transparent);
		color: var(--red);
	}

	.toast-success {
		border-color: color-mix(in srgb, var(--green) 42%, transparent);
		background: color-mix(in srgb, var(--green) 12%, var(--bg-card));
	}

	.toast-success .api-toast-icon {
		background: color-mix(in srgb, var(--green) 18%, transparent);
		color: var(--green);
	}

	.api-toast-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		flex-shrink: 0;
		background: var(--border-glass);
		color: var(--text-secondary);
	}

	.api-toast-copy {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.api-toast-copy strong {
		font-size: 14px;
		font-weight: 800;
		line-height: 1.2;
		color: var(--text-primary);
	}

	.api-toast-copy p {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--text-secondary);
		word-break: break-word;
	}

	.api-toast-dismiss {
		position: absolute;
		right: 12px;
		top: 8px;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 22px;
		line-height: 1;
		padding: 0 2px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.api-toast-dismiss:hover {
		color: var(--text-primary);
	}

	@keyframes api-toast-in {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes api-toast-out {
		from {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
		}
	}

	.inline-feedback {
		display: inline-flex;
	}

	/* ── Mobile ──────────────────────────────────────────────── */
	@media (max-width: 580px) {
		.admin-page.challenge-mode {
			min-height: calc(100vh - 96px);
			padding: 20px 0;
		}

		.challenge-panel {
			border-radius: 22px;
			padding: 24px;
		}

		.challenge-mark {
			width: 48px;
			height: 48px;
			border-radius: 16px;
		}

		.challenge-actions {
			display: grid;
			grid-template-columns: 1fr;
		}

		.challenge-actions .btn-primary,
		.challenge-actions .btn-ghost {
			width: 100%;
		}

		.admin-topbar {
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
		}

		.topbar-actions {
			width: 100%;
			justify-content: flex-start;
		}

		.github-user-card {
			width: 100%;
			border-radius: var(--radius-md);
		}

		.github-signout-btn {
			margin-left: auto;
		}

		.api-toast {
			top: 78px;
			right: 12px;
			left: 12px;
			width: auto;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.asset-row {
			grid-template-columns: 58px minmax(0, 1fr);
		}

		.asset-row img {
			width: 58px;
			height: 58px;
		}

		.asset-row .btn-ghost {
			grid-column: 1 / -1;
			width: 100%;
		}

		.asset-row-fields {
			grid-template-columns: 1fr;
		}

		.btn-primary {
			width: 100%;
		}
	}

	/* ── Body editor ─────────────────────────────────────────── */
	.body-editor {
		display: grid;
		gap: 0;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg, 12px);
		overflow: hidden;
		background: var(--bg-input, var(--bg-card));
	}

	.body-editor-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-glass);
	}

	.body-tab-group {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: var(--bg-card);
	}

	.body-tab-group button {
		padding: 3px 12px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}

	.body-tab-group button.active {
		background: var(--accent-subtle);
		color: var(--text-primary);
	}

	.toolbar-toggle {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		padding: 4px 10px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}

	.toolbar-toggle:hover,
	.toolbar-toggle.active {
		background: var(--accent-subtle);
		border-color: var(--accent-border);
		color: var(--text-primary);
	}

	.component-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border-color);
		background: color-mix(in srgb, var(--bg-glass) 60%, transparent);
	}

	.toolbar-group {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.toolbar-group-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.toolbar-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.toolbar-btn {
		padding: 3px 9px;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: var(--bg-card);
		color: var(--text-secondary);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
		white-space: nowrap;
	}

	.toolbar-btn:hover {
		background: var(--accent-subtle);
		border-color: var(--accent-border);
		color: var(--text-primary);
	}

	.body-textarea {
		width: 100%;
		min-height: 280px;
		resize: vertical;
		border: 0;
		border-radius: 0;
		padding: 12px;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		font-family: var(--font-mono, 'Courier New', monospace);
		font-size: 13px;
		line-height: 1.6;
		outline: none;
	}

	.body-preview {
		min-height: 280px;
		padding: 14px 16px;
		color: var(--text-primary);
		font-size: 14px;
		line-height: 1.75;
		overflow-wrap: break-word;
	}

	.preview-empty {
		color: var(--text-tertiary);
		font-style: italic;
	}

	/* Preview inline styles */
	:global(.pi-h1) { font-size: 1.6em; font-weight: 800; margin: 0.8em 0 0.3em; }
	:global(.pi-h2) { font-size: 1.3em; font-weight: 700; margin: 0.8em 0 0.25em; }
	:global(.pi-h3) { font-size: 1.1em; font-weight: 700; margin: 0.6em 0 0.2em; }
	:global(.pi-p) { margin: 0 0 0.6em; }
	:global(.pi-gap) { height: 0.5em; }
	:global(.pi-hr) { border: 0; border-top: 1px solid var(--border-color); margin: 1em 0; }
	:global(.pi-code) {
		padding: 1px 5px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		font-family: var(--font-mono, monospace);
		font-size: 0.88em;
	}
	:global(.pi-pre) {
		position: relative;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		line-height: 1.55;
		overflow-x: auto;
		margin: 0.5em 0 0.9em;
	}
	:global(.pi-lang) {
		position: absolute;
		top: 6px;
		right: 8px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
	}
	:global(.pi-img) { max-width: 100%; border-radius: 6px; margin: 0.4em 0; }
	:global(.pi-directive) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px dashed var(--accent-border, #7c3aed55);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		color: var(--accent);
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		font-weight: 600;
		margin: 0.4em 0;
	}

	/* Preview: cover image */
	:global(.pi-cover) {
		width: 100%;
		max-height: 200px;
		object-fit: cover;
		border-radius: 8px;
		margin-bottom: 1em;
	}

	/* Preview: gallery grid */
	:global(.pi-gallery-grid) {
		display: grid;
		gap: 10px;
		position: relative;
		margin: 0.5em 0;
	}
	:global(.pi-gallery-badge) {
		position: absolute;
		top: 8px;
		right: 8px;
		background: rgba(0,0,0,0.55);
		color: #fff;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 999px;
		font-weight: 700;
		z-index: 1;
	}
	:global(.pi-gallery-item) {
		display: grid;
		gap: 5px;
	}
	:global(.pi-gallery-img) {
		width: 100%;
		max-height: 220px;
		object-fit: cover;
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}
	:global(.pi-gallery-cap) {
		margin: 0;
		font-size: 12px;
		color: var(--text-tertiary);
		text-align: center;
	}

	/* Preview: custom components */
	:global(.pi-panel) {
		border-left: 3px solid;
		padding: 8px 12px;
		border-radius: 6px;
		margin: 0.5em 0;
	}
	:global(.pi-panel-type) {
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		display: block;
		margin-bottom: 4px;
	}
	:global(.pi-container) {
		border: 1px solid var(--border-glass);
		background: var(--bg-glass);
		border-radius: 8px;
		padding: 10px 14px;
		margin: 0.5em 0;
		backdrop-filter: blur(8px);
	}
	:global(.pi-thought) {
		border-left: 3px solid var(--accent);
		padding: 8px 14px;
		margin: 0.5em 0;
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		border-radius: 0 8px 8px 0;
	}
	:global(.pi-thought cite) {
		font-size: 12px;
		color: var(--text-tertiary);
		font-style: normal;
	}
	:global(.pi-grid) {
		display: grid;
		gap: 10px;
		margin: 0.5em 0;
	}
	:global(.pi-progress) {
		height: 16px;
		background: var(--bg-glass);
		border-radius: 999px;
		border: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
		margin: 0.5em 0;
	}
	:global(.pi-progress-bar) {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.3s;
	}
	:global(.pi-progress span) {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-primary);
	}
	:global(.pi-chip) {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--accent-subtle);
		border: 1px solid var(--accent-border);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
	}
	:global(.pi-bq) {
		border-left: 3px solid var(--border-color);
		padding: 4px 10px;
		margin: 0.4em 0;
		color: var(--text-secondary);
		font-style: italic;
	}
	:global(.pi-li) {
		margin: 0.15em 0 0.15em 1.4em;
		list-style: disc;
		display: list-item;
	}
	:global(.pi-oli) { list-style: decimal; }
	:global(.pi-comp-block) {
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px dashed var(--accent-border);
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		color: var(--accent);
		font-size: 12px;
		font-weight: 600;
		margin: 0.4em 0;
		text-align: center;
	}
	:global(.pi-chart-block) { border-color: #f59e0b55; color: #f59e0b; background: color-mix(in srgb, #f59e0b 6%, transparent); }
	:global(.pi-mermaid-block) { border-color: #22c55e55; color: #22c55e; background: color-mix(in srgb, #22c55e 6%, transparent); }

	/* Thoughts card preview */
	:global(.tc-thought-card) {
		background: var(--bg-card);
		border: 1px solid var(--border-glass);
		border-radius: 14px;
		padding: 18px 20px;
		display: grid;
		gap: 12px;
		backdrop-filter: blur(12px);
	}
	:global(.tc-thought-body) {
		margin: 0;
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-primary);
		white-space: pre-wrap;
	}
	:global(.tc-thought-meta) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	:global(.tc-thought-title) {
		font-weight: 700;
		font-size: 13px;
		color: var(--text-primary);
	}
	:global(.tc-thought-date) {
		font-size: 12px;
		color: var(--text-tertiary);
	}
	:global(.tc-thought-tags) {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	:global(.tc-tag) {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--accent-subtle);
		border: 1px solid var(--accent-border);
		font-size: 11px;
		color: var(--text-secondary);
	}

	/* ── Formatting toolbar ──────────────────────────────────── */
	.fmt-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--border-color);
		background: color-mix(in srgb, var(--bg-glass) 80%, transparent);
	}
	.fmt-btn {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		min-width: 28px;
		height: 26px;
		padding: 0 6px;
		border: 1px solid transparent;
		border-radius: 5px;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
		white-space: nowrap;
	}
	.fmt-btn:hover {
		background: var(--accent-subtle);
		border-color: var(--accent-border);
		color: var(--text-primary);
	}
	.fmt-sep {
		width: 1px;
		height: 18px;
		background: var(--border-color);
		margin: 0 3px;
		flex-shrink: 0;
	}

	/* ── PR filter bar ───────────────────────────────────────── */
	.pr-filter-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		flex-wrap: wrap;
	}
	.pr-search {
		flex: 1;
		min-width: 160px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-primary);
		padding: 7px 10px;
		font: inherit;
		font-size: 13px;
	}
	.pr-search:focus {
		outline: none;
		border-color: var(--accent-border);
	}
	.pr-status-select {
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		color: var(--text-primary);
		padding: 7px 10px;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		appearance: auto;
	}
	.pr-status-select:focus {
		outline: none;
		border-color: var(--accent-border);
	}
	/* ── PR badge ────────────────────────────────────────────── */
	.pr-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		white-space: nowrap;
	}
	.pr-badge-open {
		background: color-mix(in srgb, var(--green) 14%, transparent);
		color: var(--green);
		border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
	}
	.pr-badge-draft {
		background: var(--bg-glass);
		color: var(--text-tertiary);
		border: 1px solid var(--border-color);
	}
	.pr-badge-approved {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.pr-badge-changes {
		background: color-mix(in srgb, var(--red) 14%, transparent);
		color: var(--red);
		border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
	}
	.pr-card {
		display: grid;
		gap: 3px;
		border: 1px solid var(--border-color);
		background: var(--bg-glass);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		text-decoration: none;
		color: var(--text-primary);
		transition: border-color 0.15s;
		text-align: left;
		width: 100%;
		font: inherit;
		cursor: pointer;
	}
	.pr-card:hover {
		border-color: var(--accent-border);
	}
	.pr-card strong {
		font-size: 14px;
	}
	.pr-card > span {
		color: var(--text-tertiary);
		font-size: 12px;
	}
	.pr-card-top {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	/* ── Cover field ─────────────────────────────────────────── */
	.cover-field {
		display: grid;
		gap: 8px;
	}
	.cover-preview {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 10px;
		background: var(--bg-glass);
	}
	.cover-preview img {
		width: 100px;
		height: 70px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.cover-preview-meta {
		display: grid;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	/* ── Form row 3-col variant ──────────────────────────────── */
	.form-row-3 {
		grid-template-columns: 1fr 1fr 1fr;
	}

	/* ── PR detail modal — centered popup ───────────────────── */
	.pr-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(0, 0, 0, 0.78);
		backdrop-filter: blur(8px);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16px;
	}
	.pr-modal {
		display: flex;
		flex-direction: column;
		width: min(880px, 100%);
		/* Fixed height ensures the flex body gets a definite size so overflow-y: auto works */
		height: min(88vh, 920px);
		background: var(--bg-card);
		border: 1px solid var(--border-glass);
		border-radius: 20px;
		box-shadow: 0 32px 96px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04);
		overflow: clip;
		animation: modal-pop-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes modal-pop-in {
		from { transform: scale(0.94) translateY(12px); opacity: 0; }
		to   { transform: scale(1) translateY(0); opacity: 1; }
	}
	/* Solid top bar — no glass, no blur, purely opaque */
	.pr-modal-topbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-card);
		flex-shrink: 0;
	}
	.pr-drawer-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}
	.pr-drawer-close:hover {
		background: color-mix(in srgb, var(--red) 12%, transparent);
		border-color: color-mix(in srgb, var(--red) 40%, transparent);
		color: var(--red);
	}
	.pr-topbar-num {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-tertiary);
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 1px 6px;
		flex-shrink: 0;
		font-family: var(--font-mono, monospace);
	}
	.pr-drawer-title {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Accent GitHub button — used in pr-info-block */
	.pr-drawer-github {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.12s, transform 0.1s;
		flex-shrink: 0;
	}
	.pr-drawer-github:hover { opacity: 0.88; transform: translateY(-1px); }
	.pr-drawer-github:active { transform: scale(0.97); }

	/* PR info block: status / author-date-branch / GitHub link */
	.pr-info-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 16px;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
	}
	/* Top row: badges on left, GitHub button on right */
	.pr-info-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}
	.pr-info-left {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	/* Bottom row: author/date + branch (full width) */
	.pr-info-details {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 16px;
		padding-top: 4px;
		border-top: 1px solid var(--border-color);
	}
	.pr-info-author-date {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 13px;
		color: var(--text-secondary);
	}
	.pr-info-author-date strong { color: var(--text-primary); font-weight: 600; }
	.pr-info-sep { color: var(--text-tertiary); }
	.pr-info-author-date time { color: var(--text-tertiary); font-size: 12px; }
	.pr-info-branch {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}
	.pr-info-label {
		color: var(--text-tertiary);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 10px;
		letter-spacing: 0.06em;
	}
	.pr-info-branch-val {
		color: var(--text-secondary);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 260px;
	}
	.branch-copy-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--border-color);
		border-radius: 5px;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
		padding: 0;
	}
	.branch-copy-btn:hover {
		background: var(--bg-glass);
		color: var(--text-primary);
	}
	.branch-copy-btn.branch-copied {
		color: var(--green, #22c55e);
		border-color: color-mix(in srgb, var(--green, #22c55e) 40%, transparent);
		background: color-mix(in srgb, var(--green, #22c55e) 8%, transparent);
	}
	.pr-drawer-loading {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		color: var(--text-tertiary);
		font-size: 13px;
	}
	.pr-loading-spinner {
		animation: spin 0.9s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.pr-modal-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 20px;
		display: grid;
		gap: 16px;
		align-content: start;
	}
	.pr-review-status {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
	}
	.review-approved { background: color-mix(in srgb, var(--green) 14%, transparent); color: var(--green); border: 1px solid color-mix(in srgb, var(--green) 30%, transparent); }
	.review-changes  { background: color-mix(in srgb, var(--red) 14%, transparent); color: var(--red); border: 1px solid color-mix(in srgb, var(--red) 30%, transparent); }
	.review-pending  { background: var(--bg-glass); color: var(--text-tertiary); border: 1px solid var(--border-color); }
	.pr-files-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	.pr-files-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 9px 12px;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s, color 0.12s;
	}
	.pr-files-toggle:hover {
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		color: var(--text-primary);
	}
	.pr-files-toggle span { flex: 1; }
	.pr-files-chevron {
		flex-shrink: 0;
		transition: transform 0.2s;
		color: var(--text-tertiary);
	}
	.pr-files-chevron.rotated { transform: rotate(180deg); }
	.pr-files {
		display: grid;
		gap: 2px;
		padding: 0 12px 10px;
	}
	.pr-file-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.pr-file-role {
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		color: var(--text-tertiary);
		white-space: nowrap;
	}
	.role-content { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); border-color: var(--accent-border); }
	.role-asset { background: color-mix(in srgb, #f59e0b 10%, transparent); color: #f59e0b; border-color: #f59e0b55; }
	.pr-file-path {
		font-size: 11px;
		color: var(--text-secondary);
		font-family: var(--font-mono, monospace);
		word-break: break-all;
	}
	/* Post-like preview layout inside the PR modal */
	.pr-post-preview {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-glass);
		overflow: scroll;
	}
	.pr-post-cover {
		display: block;
		width: 100%;
		max-height: 340px;
		object-fit: cover;
	}
	.pr-post-body {
		padding: 24px 28px 28px;
	}
	.pr-post-header {
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--border-color);
	}
	.pr-post-title {
		font-size: 1.55em;
		font-weight: 800;
		line-height: 1.25;
		color: var(--text-primary);
		margin: 0 0 8px;
	}
	.pr-post-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-tertiary);
	}
	.pr-post-date { font-variant-numeric: tabular-nums; }
	.pr-post-category {
		padding: 1px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		font-weight: 600;
		font-size: 11px;
	}
	.pr-post-summary {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
	}
	.pr-post-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}
	.pr-post-tag {
		padding: 2px 9px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		background: var(--bg-glass);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	/* Preview load error fallback */
	.pr-preview-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 10px;
		padding: 48px 24px;
		color: var(--text-secondary);
	}
	.pr-preview-error svg {
		color: var(--text-tertiary);
		flex-shrink: 0;
	}
	.pr-preview-error-msg {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}
	.pr-preview-error-sub {
		font-size: 13px;
		color: var(--text-tertiary);
		margin: 0;
		max-width: 360px;
	}
	.pr-error-github {
		margin-top: 8px;
	}

	/* Too-many-blobs warning banner */
	.pr-blobs-warning {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, #f59e0b 10%, transparent);
		border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
		font-size: 12px;
		color: #b45309;
	}
	:global([data-theme='dark']) .pr-blobs-warning { color: #fbbf24; }
	.pr-blobs-warning svg { flex-shrink: 0; color: #f59e0b; }
	.pr-blobs-warning a { color: inherit; text-decoration: underline; }

	/* Fix 3: Hide layout sidebar and mobile header while PR modal is open */
	:global(body.pr-modal-open) :global(#sidebar),
	:global(body.pr-modal-open) :global(.mobile-header) {
		display: none !important;
	}

	@media (max-width: 580px) {
		/* PR modal — full-screen bottom sheet on mobile */
		.pr-modal-overlay {
			padding: 0;
			align-items: flex-end;
		}
		.pr-modal {
			width: 100%;
			/* Full viewport — no gap at top on small screens */
			height: 100dvh;
			border-radius: 0;
			/* Safe area for notch/home indicator */
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}
		.pr-modal-topbar {
			padding: 12px 14px;
			padding-top: max(12px, env(safe-area-inset-top, 12px));
		}
		.pr-modal-body {
			padding: 14px;
		}
		/* Info block adapts to narrow viewport */
		.pr-info-block {
			padding: 10px 12px;
		}
		.pr-info-top {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}
		.pr-drawer-github {
			width: 100%;
			justify-content: center;
		}
		.pr-info-details {
			gap: 4px 12px;
		}
		.pr-info-branch-val {
			max-width: 180px;
		}
		/* Files toggle */
		.pr-files-toggle {
			padding: 10px 12px;
		}
		/* Content preview */
		.pr-post-body {
			padding: 16px 14px 24px;
		}
		/* Nav picker */
		.nav-picker-overlay {
			padding: 0;
			align-items: flex-end;
		}
		.nav-picker-modal {
			width: 100%;
			height: 85dvh;
			border-radius: 20px 20px 0 0;
		}
		/* Form layout */
		.form-row-3 {
			grid-template-columns: 1fr;
		}
		.prev-next-row {
			grid-template-columns: 1fr;
		}
	}

	/* ── Prev / next field ───────────────────────────────────── */
	.prev-next-row {
		grid-template-columns: 1fr 1fr;
		align-items: start;
	}
	.nav-field-wrap {
		display: grid;
		gap: 6px;
	}
	.nav-pick-trigger {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border: 1px dashed var(--border-color);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		font-size: 13px;
		cursor: pointer;
		width: 100%;
		transition: border-color 0.12s, color 0.12s;
	}
	.nav-pick-trigger:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.nav-selected-chip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px;
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.nav-chip-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.nav-chip-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nav-chip-slug {
		font-size: 11px;
		color: var(--text-tertiary);
		font-family: var(--font-mono, monospace);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nav-chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		transition: background 0.1s, color 0.1s;
	}
	.nav-chip-remove:hover {
		background: color-mix(in srgb, var(--red) 15%, transparent);
		color: var(--red);
	}

	/* ── Nav picker popup ────────────────────────────────────── */
	.nav-picker-overlay {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16px;
	}
	.nav-picker-modal {
		display: flex;
		flex-direction: column;
		width: min(560px, 100%);
		height: min(72vh, 640px);
		background: var(--bg-card);
		border: 1px solid var(--border-glass);
		border-radius: 18px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
		overflow: clip;
		animation: modal-pop-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.nav-picker-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.nav-picker-title {
		flex: 1;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
	}
	.nav-picker-search-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.nav-picker-search-icon { color: var(--text-tertiary); flex-shrink: 0; }
	.nav-picker-input {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-size: 14px;
		outline: none;
	}
	.nav-picker-input::placeholder { color: var(--text-tertiary); }
	.nav-picker-clear {
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		padding: 2px 4px;
	}
	.nav-picker-clear:hover { color: var(--text-primary); }
	.nav-picker-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px;
	}
	.nav-picker-item {
		display: flex;
		flex-direction: column;
		gap: 3px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}
	.nav-picker-item:hover,
	.nav-picker-item[aria-selected='true'] {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.nav-picker-item[aria-selected='true'] .nav-picker-item-title {
		color: var(--accent);
	}
	.nav-picker-item-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.35;
	}
	.nav-picker-item-slug {
		font-size: 11px;
		color: var(--text-tertiary);
		font-family: var(--font-mono, monospace);
	}
	.nav-picker-empty {
		padding: 40px 20px;
		text-align: center;
		color: var(--text-secondary);
		font-size: 13px;
	}
	.nav-picker-empty p { margin: 0 0 6px; }
	.nav-picker-empty-sub { font-size: 12px; color: var(--text-tertiary); }
</style>
