export interface AdminCustomComponent {
	id: string;
	label: string;
	group: 'directive' | 'html' | 'code' | 'enhancement';
	description: string;
	snippet: string;
	preview: string;
	/** If set, only show this component for these content types. undefined = all types. */
	supportedTypes?: string[];
}

export const raksaraCustomComponents: AdminCustomComponent[] = [
	{
		id: 'cards',
		label: 'Content Cards',
		group: 'directive',
		description: 'Responsive card grid from a content path. Optional limit shows a "Show more" button.',
		snippet: '::cards(blog/)',
		preview: 'Renders a 1–3 column card grid sorted by most recent date. Cards show cover image, title, description, and date.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'carousels',
		label: 'Content Carousel',
		group: 'directive',
		description: 'Infinite-loop carousel from a content path. Optional limit shows a "Show more" button.',
		snippet: '::carousels(blog/)',
		preview: 'Renders a responsive carousel with partial side-cards, auto-advance, swipe, and keyboard support.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'component-list',
		label: 'Component List',
		group: 'directive',
		description: 'Searchable card list generated from existing metadata.',
		snippet: '::component(pages/doc)',
		preview: 'Renders cards for markdown files under the selected content path.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'chapters',
		label: 'Chapters Table',
		group: 'directive',
		description: 'Sortable chapter table for a blog directory.',
		snippet: '::chapters(blog/my-series)',
		preview: 'Uses blog directory metadata and shows direct child posts per directory.',
		supportedTypes: ['blog', 'pages']
	},
	{
		id: 'toc',
		label: 'Table of Contents',
		group: 'directive',
		description: 'Collapsible heading index for the current document.',
		snippet: '::toc(type=bullet, level=3)',
		preview: 'Builds links from rendered heading ids.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'file',
		label: 'File Attachment',
		group: 'directive',
		description: 'Downloadable file card with extension badge and size lookup.',
		snippet: '::file[content/assets/files/report.pdf "Report"]',
		preview: 'Shows a glass file card linked to the asset.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'panel',
		label: 'Panel',
		group: 'html',
		description: 'Styled note, warning, success, info, or error block.',
		snippet: '<panel type="info">\\nWrite panel content here.\\n</panel>',
		preview: 'Renders markdown inside a semantic note container.'
	},
	{
		id: 'container',
		label: 'Container',
		group: 'html',
		description: 'Glass container for grouped markdown content.',
		snippet: '<container>\\nGrouped content here.\\n</container>',
		preview: 'Renders nested markdown in a glass content block.'
	},
	{
		id: 'chip',
		label: 'Chip',
		group: 'html',
		description: 'Inline badge with optional icon and label.',
		snippet: '<chip icon="tag" label="Type">Documentation</chip>',
		preview: 'Renders as an inline pill.'
	},
	{
		id: 'grid',
		label: 'Grid',
		group: 'html',
		description: 'Responsive grid wrapper for markdown blocks.',
		snippet: '<grid cols="3" gap="1rem">\\n<panel type="info">One</panel>\\n<panel type="success">Two</panel>\\n</grid>',
		preview: 'Renders nested markdown in equal columns.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'progress',
		label: 'Progress Bar',
		group: 'html',
		description: 'Animated progress bar with optional milestone markers.',
		snippet: '<rk-progress total="100" current="72" color="green">\\n  <bar at="50" icon="flag">Halfway</bar>\\n</rk-progress>',
		preview: 'Hydrates as an animated progress track.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'thought',
		label: 'Thought Bubble',
		group: 'html',
		description: 'Attributed quote bubble with optional author/logo/alignment.',
		snippet: '<thought author="Yunaz" align="right">\\nAny markdown quote can go here.\\n</thought>',
		preview: 'Renders a quote bubble with attribution.'
	},
	{
		id: 'chart',
		label: 'Chart Block',
		group: 'code',
		description: 'Chart.js configuration inside a fenced code block.',
		snippet: '```chart\\n{ type: "bar", data: { labels: ["A"], datasets: [{ label: "Value", data: [1] }] } }\\n```',
		preview: 'Hydrates Chart.js only on pages that need it.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'mermaid',
		label: 'Mermaid Diagram',
		group: 'code',
		description: 'Mermaid diagram inside a fenced code block.',
		snippet: '```mermaid\\nflowchart TD\\n  A[Start] --> B[Done]\\n```',
		preview: 'Hydrates Mermaid only on pages that need it.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'video-player',
		label: 'Video Player',
		group: 'enhancement',
		description: 'Enhanced linked thumbnail that opens a video URL.',
		snippet: '<a class="video-player" href="https://www.youtube.com/watch?v=VIDEO_ID" target="_blank">\\n  <img src="https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg" alt="Video title" />\\n</a>',
		preview: 'Transforms into a play-card button after render.',
		supportedTypes: ['blog', 'portfolio', 'pages']
	},
	{
		id: 'sortable-table',
		label: 'Sortable Table',
		group: 'enhancement',
		description: 'Standard Markdown tables become sortable automatically.',
		snippet: '| Name | Value |\\n|---|---:|\\n| Alpha | 1 |',
		preview: 'Table headers become interactive after render.'
	}
];

export const adminContentTypes = [
	{
		id: 'blog',
		label: 'Blog Post',
		path: 'content/blog',
		assetPath: 'content/assets',
		description: 'Standard article content. Novel, poem, chapters, and comic entries are modeled with the blog frontmatter type.'
	},
	{
		id: 'portfolio',
		label: 'Portfolio',
		path: 'content/portfolio',
		assetPath: 'content/assets',
		description: 'Project pages with optional GitHub/demo links and status.'
	},
	{
		id: 'gallery',
		label: 'Gallery',
		path: 'content/gallery',
		assetPath: 'content/assets',
		description: 'Image-first entries with single image or images array.'
	},
	{
		id: 'thoughts',
		label: 'Thought',
		path: 'content/thoughts',
		assetPath: 'content/assets',
		description: 'Short-form writing surfaced on the thoughts page.'
	},
	{
		id: 'pages',
		label: 'Page / Doc',
		path: 'content/pages',
		assetPath: 'content/assets',
		description: 'Static pages and documentation pages under pages/doc.'
	}
];

/** Returns the components visible for a given content type and (optionally) blog subtype. */
export function getComponentsForType(
	type: string,
	subtype = ''
): AdminCustomComponent[] {
	if (type === 'gallery') return [];

	// Poem, novel, comic get limited formatting components only
	if (type === 'blog' && subtype && subtype !== 'article') {
		return raksaraCustomComponents.filter((c) =>
			['panel', 'chip', 'thought'].includes(c.id)
		);
	}

	// thoughts type
	if (type === 'thoughts') {
		return raksaraCustomComponents.filter((c) =>
			['panel', 'chip', 'thought', 'sortable-table'].includes(c.id)
		);
	}

	// blog article, portfolio, pages: all components that support this type
	return raksaraCustomComponents.filter(
		(c) => !c.supportedTypes || c.supportedTypes.includes(type)
	);
}
