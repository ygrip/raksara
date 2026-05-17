<script lang="ts">
	/**
	 * Direct share button.
	 * Mirrors legacy initShareButton(): one button, no menu.
	 */
	import { shareContent } from '$lib/share';

	interface Props {
		title: string;
		summary?: string;
		author?: string;
		coverUrl?: string;
		tags?: string[];
		date?: string;
		variant?: 'detail' | 'profile' | 'directory' | 'gallery' | 'thoughts' | 'portfolio-detail';
		avatarUrl?: string;
		role?: string;
		metadata?: Array<{ label?: string; value?: string }>;
		pageCount?: number;
		pageLabel?: string;
		itemTitles?: string[];
		galleryImageUrls?: string[];
	}

	let { title, summary, author, coverUrl, tags, date, variant, avatarUrl, role, metadata, pageCount, pageLabel, itemTitles, galleryImageUrls }: Props = $props();

	let generating = $state(false);

	async function share() {
		generating = true;
		try {
			await shareContent({ title, summary, author, coverUrl, tags, date, variant, avatarUrl, role, metadata, pageCount, pageLabel, itemTitles, galleryImageUrls });
		} catch {
			// User cancelled.
		} finally {
			generating = false;
		}
	}
</script>

<button class="share-btn" onclick={share} disabled={generating} aria-label="Share">
	<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="12" cy="3.5" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M5.8 7.1l4.4-2.5M5.8 8.9l4.4 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
	<span>{generating ? 'Generating...' : 'Share'}</span>
</button>
