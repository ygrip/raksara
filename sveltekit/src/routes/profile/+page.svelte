<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import { initArticleFeatures } from '$lib/markdown';
	import { assetUrl } from '$lib/utils';
	import { shareContent } from '$lib/share';

	let { data }: { data: PageData } = $props();
	const profile = $derived(data.profile);
	const prerenderHtml = $derived(data.prerenderHtml);
	const config   = $derived(data.config);

	let containerEl: HTMLElement | null = $state(null);
	let cleanupParallax: (() => void) | null = null;

	// ── Easter egg: 7 taps on avatar → /admin ──────────────────
	let eggCount = $state(0);
	let eggToast = $state('');
	let eggToastVisible = $state(false);
	let eggResetTimer: ReturnType<typeof setTimeout> | null = null;
	let eggToastTimer: ReturnType<typeof setTimeout> | null = null;

	function showEggToast(msg: string) {
		if (eggToastTimer) clearTimeout(eggToastTimer);
		eggToast = msg;
		eggToastVisible = true;
		eggToastTimer = setTimeout(() => (eggToastVisible = false), 1800);
	}

	function handleAvatarTap() {
		if (eggResetTimer) clearTimeout(eggResetTimer);
		eggCount += 1;
		// Reset if no tap for 2 seconds
		eggResetTimer = setTimeout(() => (eggCount = 0), 2000);

		if (eggCount === 5) {
			showEggToast('🔐 2 more...');
		} else if (eggCount === 6) {
			showEggToast('🔐 1 more...');
		} else if (eggCount >= 7) {
			eggCount = 0;
			eggToastVisible = false;
			window.location.href = '/admin/';
		}
	}

	function initAvatarEasterEgg() {
		const avatarWrap = containerEl?.querySelector<HTMLElement>('.profile-avatar-wrap');
		if (!avatarWrap || avatarWrap.dataset['eggInit'] === '1') return;
		avatarWrap.dataset['eggInit'] = '1';
		avatarWrap.addEventListener('click', handleAvatarTap);
	}

	function initProfileMedia() {
		const bg = containerEl?.querySelector<HTMLElement>('#profile-hero-bg');
		const skeleton = containerEl?.querySelector<HTMLElement>('.profile-hero-skeleton');
		const rawCover = bg?.dataset['src'];
		const coverUrl = rawCover ? assetUrl(rawCover) : '';
		if (bg && coverUrl) {
			const img = new Image();
			img.onload = () => {
				bg.style.setProperty('--profile-hero-image', `url('${coverUrl}')`);
				bg.classList.add('loaded');
				skeleton?.classList.add('hidden');
			};
			img.onerror = () => skeleton?.classList.add('hidden');
			img.src = coverUrl;
		} else {
			skeleton?.classList.add('hidden');
		}

		const avatarWrap = containerEl?.querySelector<HTMLElement>('.profile-avatar-wrap');
		const avatar = avatarWrap?.querySelector<HTMLImageElement>('.profile-avatar');
		if (avatar) {
			avatar.src = assetUrl(avatar.getAttribute('src') ?? '');
			const settle = () => {
				avatarWrap?.classList.remove('is-loading');
				avatarWrap?.classList.add('loaded', 'is-loaded');
			};
			if (avatar.complete && avatar.naturalWidth > 0) settle();
			else {
				avatar.addEventListener('load', settle, { once: true });
				avatar.addEventListener('error', settle, { once: true });
			}
		}
	}

	function initProfileParallax() {
		cleanupParallax?.();
		cleanupParallax = null;

		const heroBg = containerEl?.querySelector<HTMLElement>('#profile-hero-bg');
		const hero = heroBg?.closest<HTMLElement>('.profile-hero');
		if (!hero || !heroBg) return;

		let heroTop = 0;
		let heroHeight = 0;
		let ticking = false;

		const measure = () => {
			const rect = hero.getBoundingClientRect();
			heroTop = window.scrollY + rect.top;
			heroHeight = rect.height;
		};

		const update = () => {
			ticking = false;
			const scrollY = window.scrollY;
			if (scrollY > heroTop + heroHeight || scrollY + window.innerHeight < heroTop) return;
			const delta = Math.max(scrollY - heroTop, 0);
			heroBg.style.transform = `translate3d(0, ${-delta * 0.35}px, 0) scale(1.1)`;
		};

		const requestUpdate = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(update);
		};

		const resizeObserver = new ResizeObserver(() => {
			measure();
			requestUpdate();
		});

		measure();
		requestUpdate();
		resizeObserver.observe(hero);
		window.addEventListener('scroll', requestUpdate, { passive: true });
		window.addEventListener('resize', measure, { passive: true });

		cleanupParallax = () => {
			resizeObserver.disconnect();
			window.removeEventListener('scroll', requestUpdate);
			window.removeEventListener('resize', measure);
			heroBg.style.transform = '';
		};
	}

	function initProfileShare() {
		const button = containerEl?.querySelector<HTMLButtonElement>('.profile-hero-share .share-btn');
		if (!button || button.dataset['shareInit'] === '1') return;
		button.dataset['shareInit'] = '1';
		button.addEventListener('click', async () => {
			const label = button.querySelector('span');
			const original = label?.textContent ?? 'Share';
			if (label) label.textContent = 'Generating...';
			button.disabled = true;
			await shareContent({
				title: profile?.title ?? 'Profile',
				summary: profile?.summary,
				author: config?.author,
				coverUrl: profile?.cover,
				avatarUrl: profile?.avatar,
				role: profile?.role,
				metadata: (profile?.metadata ?? []).map((item) => typeof item === 'string' ? { label: item, value: '' } : { label: item.label, value: item.value }),
				variant: 'profile',
				url: location.href,
			});
			button.disabled = false;
			if (label) label.textContent = original;
		});
	}

	onMount(async () => {
		await tick();
		if (containerEl) {
			initProfileMedia();
			initProfileParallax();
			initProfileShare();
			initAvatarEasterEgg();
			await initArticleFeatures(containerEl);
		}
	});

	$effect(() => {
		if (!prerenderHtml || !containerEl) return;
		(async () => {
			await tick();
			initProfileMedia();
			initProfileParallax();
			initProfileShare();
			initAvatarEasterEgg();
			if (containerEl) await initArticleFeatures(containerEl);
		})();
	});

	onDestroy(() => {
		cleanupParallax?.();
		if (eggResetTimer) clearTimeout(eggResetTimer);
		if (eggToastTimer) clearTimeout(eggToastTimer);
	});
	const ogBase = $derived(String(config?.site_url ?? config?.url ?? '').replace(/\/+$/, ''));
	/**
	 * Use the build-generated profile OG image (avatar + name card, 1200×630).
	 * Falls back to the type-default if the build hasn't produced it yet.
	 */
	const ogProfileImage = $derived(
		ogBase ? `${ogBase}/og/profile.jpg` : '/og/profile.jpg'
	);
	const profileDescription = $derived(
		profile?.summary
			?? config?.description
			?? config?.hero_subtitle
			?? profile?.role
			?? profile?.title
			?? config?.hero_title
			?? config?.title
			?? ''
	);
</script>

<svelte:head>
	<title>{profile?.title ?? 'Profile'} · {config?.hero_title ?? config?.title ?? 'Raksara'}</title>
	<meta name="description" content={profileDescription} />
	<meta property="og:title" content="{profile?.title ?? 'Profile'} · {config?.hero_title ?? config?.title ?? 'Raksara'}" />
	<meta property="og:description" content={profileDescription} />
	<meta property="og:type" content="profile" />
	<meta property="og:url" content="{ogBase}/profile/" />
	<meta property="og:image" content={ogProfileImage} />
	<meta name="twitter:image" content={ogProfileImage} />
</svelte:head>

{#if prerenderHtml}
	<!-- Render the pre-built profile HTML (includes .profile-hero, .profile-metadata, .article-body) -->
	<div bind:this={containerEl}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html prerenderHtml}
	</div>
{:else}
	<!-- Fallback: minimal profile when prerender is unavailable -->
	<div class="profile-hero" aria-label="Profile hero"></div>
	<div class="mt-8" style="color: var(--text-primary);">
		<h1 class="text-3xl font-bold">{profile?.title ?? 'Profile'}</h1>
		{#if profile?.summary}
			<p class="mt-2 text-lg" style="color: var(--text-secondary);">{profile.summary}</p>
		{/if}
	</div>
{/if}

<!-- Easter egg toast -->
{#if eggToastVisible}
	<div class="egg-toast" aria-live="polite">{eggToast}</div>
{/if}

<style>
	.egg-toast {
		position: fixed;
		bottom: 88px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.82);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		padding: 8px 18px;
		border-radius: 999px;
		pointer-events: none;
		z-index: 9999;
		white-space: nowrap;
		backdrop-filter: blur(8px);
		animation: egg-toast-in 0.18s ease;
		letter-spacing: 0.02em;
	}
	@keyframes egg-toast-in {
		from { opacity: 0; transform: translateX(-50%) translateY(6px); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
</style>
