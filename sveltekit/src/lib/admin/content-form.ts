import type { AdminAssetUpload, CreateContentPrPayload } from './admin-client';

/** A reference to another piece of content for prev/next navigation. */
export interface NavRef {
	title: string;
	slug: string;
	section: 'blog' | 'pages';
}

export interface AdminContentFormState {
	type: string;
	/** Blog subtype: 'article' | 'poem' | 'novel' | 'comic'. Only used when type === 'blog'. */
	subtype: string;
	title: string;
	slug: string;
	date: string;
	summary: string;
	category: string;
	tags: string[];
	status: string;
	github: string;
	demo: string;
	body: string;
	/** Cover image for blog (all subtypes), portfolio, pages. null for gallery/thoughts. */
	coverAsset?: AdminAssetUpload;
	/** Previous page/post for navigation (blog and pages only). */
	prevPage?: NavRef | null;
	/** Next page/post for navigation (blog and pages only). */
	nextPage?: NavRef | null;
}

export function slugifyAdmin(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

export function createDefaultContentForm(): AdminContentFormState {
	return {
		type: 'blog',
		subtype: 'article',
		title: '',
		slug: '',
		date: new Date().toISOString().slice(0, 10),
		summary: '',
		category: '',
		tags: [],
		status: '',
		github: '',
		demo: '',
		body: '',
		coverAsset: undefined,
		prevPage: null,
		nextPage: null
	};
}

export function parseFreeTextList(value: string) {
	return value
		.split(/[,\n]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function quoteYaml(value: string) {
	return JSON.stringify(value);
}

function publicAssetPath(path: string) {
	return `/${path.replace(/^\/+/, '')}`;
}

function fileExtension(fileName: string) {
	const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
	return match?.[1] || 'bin';
}

export function buildAssetPath(type: string, slug: string, fileName: string, index: number) {
	const extension = fileExtension(fileName);
	const baseName = slugifyAdmin(fileName.replace(/\.[^.]+$/, '')) || `asset-${index + 1}`;
	const safeSlug = slugifyAdmin(slug) || 'draft';
	const prefix = type === 'gallery' ? 'gallery' : type;
	// Paths are relative to the content repo root (no leading "content/" — that's the
	// repo itself). The build pipeline copies the content repo into sveltekit/static/content/,
	// so assets/images/... becomes /content/assets/images/... at serve time.
	return `assets/images/${prefix}/${safeSlug}/${String(index + 1).padStart(2, '0')}-${baseName}.${extension}`;
}

export function buildCoverAssetPath(type: string, slug: string, fileName: string): string {
	const extension = fileExtension(fileName);
	const safeSlug = slugifyAdmin(slug) || 'draft';
	return `assets/images/${type}/${safeSlug}/cover.${extension}`;
}

/** Path for a ::file attachment asset — goes to content/assets/files/ not images/. */
export function buildFileAssetPath(slug: string, fileName: string): string {
	const extension = fileExtension(fileName);
	const baseName = slugifyAdmin(fileName.replace(/\.[^.]+$/, '')) || 'file';
	const safeSlug = slugifyAdmin(slug) || 'draft';
	return `assets/files/${safeSlug}/${baseName}.${extension}`;
}

/**
 * File extensions accepted by the ::file component and the worker.
 * Keep in sync with DEFAULT_ALLOWED_ASSET_EXTENSIONS in workers/admin/src/index.js.
 */
export const ALLOWED_FILE_ATTACHMENT_EXTENSIONS = [
	// Images
	'webp', 'jpg', 'jpeg', 'png', 'gif', 'svg',
	// Documents
	'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
	// Archives
	'zip', 'rar', 'gz', 'tar', '7z',
	// Video
	'mp4', 'mov', 'mkv', 'webm',
	// Audio
	'mp3', 'wav', 'ogg', 'flac',
] as const;

export const FILE_ATTACHMENT_ACCEPT = ALLOWED_FILE_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(',');

/** Returns true if this form state should display a cover image upload. */
export function hasCoverField(form: AdminContentFormState): boolean {
	if (form.type === 'gallery' || form.type === 'thoughts') return false;
	return true; // blog (all subtypes: article, poem, novel, comic), portfolio, pages
}

/** Returns true if this form state supports prev/next navigation fields. */
export function hasPrevNextField(form: AdminContentFormState): boolean {
	return form.type === 'blog' || form.type === 'pages';
}

function navRefLink(ref: NavRef): string {
	return ref.section === 'blog' ? `/blog/post/${ref.slug}` : `/${ref.slug}`;
}

function buildFrontmatter(
	form: AdminContentFormState,
	assets: AdminAssetUpload[],
	coverAsset?: AdminAssetUpload
): string {
	const lines = ['---'];
	const title = form.title.trim() || 'Untitled';
	const tags = form.tags;
	const cover = coverAsset?.path ? publicAssetPath(coverAsset.path) : '';

	lines.push(`title: ${quoteYaml(title)}`);
	if (form.date) lines.push(`date: ${form.date}`);
	if (form.summary.trim()) lines.push(`summary: ${quoteYaml(form.summary.trim())}`);
	if (form.category.trim()) lines.push(`category: ${quoteYaml(form.category.trim())}`);
	if (tags.length) {
		lines.push('tags:');
		for (const tag of tags) lines.push(`  - ${quoteYaml(tag)}`);
	}

	if (form.type === 'portfolio') {
		lines.push('type: project');
		if (form.status.trim()) lines.push(`status: ${quoteYaml(form.status.trim())}`);
		if (form.github.trim()) lines.push(`github: ${quoteYaml(form.github.trim())}`);
		if (form.demo.trim()) lines.push(`demo: ${quoteYaml(form.demo.trim())}`);
		if (cover) lines.push(`cover: ${quoteYaml(cover)}`);
	} else if (form.type === 'gallery') {
		if (assets.length === 1) {
			lines.push(`image: ${quoteYaml(publicAssetPath(assets[0].path))}`);
			if (assets[0].caption) lines.push(`caption: ${quoteYaml(assets[0].caption)}`);
		} else if (assets.length > 1) {
			lines.push('images:');
			for (const asset of assets) {
				lines.push(`  - src: ${quoteYaml(publicAssetPath(asset.path))}`);
				if (asset.caption) lines.push(`    caption: ${quoteYaml(asset.caption)}`);
				if (asset.alt) lines.push(`    alt: ${quoteYaml(asset.alt)}`);
			}
		}
	} else if (form.type === 'blog') {
		// Poem / novel / comic: add type frontmatter
		if (form.subtype && form.subtype !== 'article') {
			lines.push(`type: ${form.subtype}`);
		}
		if (cover) lines.push(`cover: ${quoteYaml(cover)}`);
	} else {
		// pages, thoughts
		if (cover) lines.push(`cover: ${quoteYaml(cover)}`);
	}

	// Prev / next navigation (blog and pages only)
	if (form.prevPage) {
		lines.push('previous_page:');
		lines.push(`  title: ${quoteYaml(form.prevPage.title)}`);
		lines.push(`  link: ${quoteYaml(navRefLink(form.prevPage))}`);
	}
	if (form.nextPage) {
		lines.push('next_page:');
		lines.push(`  title: ${quoteYaml(form.nextPage.title)}`);
		lines.push(`  link: ${quoteYaml(navRefLink(form.nextPage))}`);
	}

	lines.push('---');
	return lines.join('\n');
}

export function buildContentMarkdown(
	form: AdminContentFormState,
	assets: AdminAssetUpload[],
	coverAsset?: AdminAssetUpload
) {
	const title = form.title.trim() || 'Untitled';
	const body = form.body.trim();
	const frontmatter = buildFrontmatter(form, assets, coverAsset);

	if (form.type === 'gallery') return `${frontmatter}\n`;
	if (body) return `${frontmatter}\n\n${body}\n`;
	return `${frontmatter}\n\n# ${title}\n\nWrite your content here.\n`;
}

export function buildContentPrPayload(
	form: AdminContentFormState,
	/** For gallery: all uploaded images. For non-gallery: inline body images only. */
	assets: AdminAssetUpload[],
	coverAsset?: AdminAssetUpload
): CreateContentPrPayload {
	const slug = slugifyAdmin(form.slug || form.title);
	// Merge cover (first) + body assets for the PR payload
	const allAssets: AdminAssetUpload[] = coverAsset
		? [coverAsset, ...assets]
		: [...assets];
	return {
		type: form.type,
		title: form.title.trim(),
		slug,
		frontmatter: {
			tags: form.tags,
			category: form.category.trim() || undefined
		},
		markdown: buildContentMarkdown({ ...form, slug }, assets, coverAsset),
		assets: allAssets
	};
}
