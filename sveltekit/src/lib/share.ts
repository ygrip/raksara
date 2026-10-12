import { assetUrl } from '$lib/utils';
import { mixRgb, parseCssColor, rgba, type Rgb } from '$lib/css-color';

export interface SharePayload {
	title: string;
	summary?: string;
	author?: string;
	coverUrl?: string;
	tags?: string[];
	date?: string;
	url?: string;
	variant?: 'detail' | 'profile' | 'directory' | 'gallery' | 'gallery-item' | 'thoughts' | 'portfolio-detail';
	avatarUrl?: string;
	role?: string;
	metadata?: Array<{ label?: string; value?: string }>;
	pageCount?: number;
	pageLabel?: string;
	itemTitles?: string[];
	galleryImageUrls?: string[];
}

/*
 * Share cards reproduce the site's Heritage Glass look: accent dot grid and
 * fireflies on the theme canvas, one frosted glass plate with carved ukiran
 * corners and spines, Cormorant display type over Jakarta body copy, and a
 * medallion footer. Colours derive from the live `--accent` and theme.
 */
const SIZE = 1080;
const CARD = { x: 44, y: 44, w: SIZE - 88, h: SIZE - 88, r: 40 };
const PAD = 76;
const INNER_X = CARD.x + PAD;
const INNER_W = CARD.w - PAD * 2;
const CONTENT_TOP = CARD.y + PAD;
const FOOTER_LINE = CARD.y + CARD.h - PAD - 96;
const CONTENT_BOTTOM = FOOTER_LINE - 40;
const DISPLAY = '"Raksara Cormorant", "Cormorant Garamond", Georgia, serif';
const SANS = '"Raksara Jakarta", "Plus Jakarta Sans", system-ui, sans-serif';

const ORNAMENTS = {
	tl: '/heritage/ukiran-corner-tl.webp',
	tr: '/heritage/ukiran-corner-tr.webp',
	bl: '/heritage/ukiran-corner-bl.webp',
	br: '/heritage/ukiran-corner-br.webp',
	side: '/heritage/ukiran-side.webp',
	divider: '/heritage/ukiran-divider.webp'
} as const;
type Ornaments = Partial<Record<keyof typeof ORNAMENTS, HTMLImageElement>>;

interface ShareTheme {
	dark: boolean;
	bg: Rgb;
	ink: Rgb;
	inkSoft: Rgb;
	accent: Rgb;
	accentText: Rgb;
	hi: Rgb;
	lo: Rgb;
	frost: string;
	surface: string;
	edge: string;
	line: string;
	lineSoft: string;
	tint: string;
	carve: number;
}

type Rect = { x: number; y: number; w: number; h: number; r: number };

function isMobileShareDevice(): boolean {
	const ua = navigator.userAgent || '';
	return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && matchMedia('(max-width: 900px)').matches);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y, x + w, y + r, r);
	ctx.lineTo(x + w, y + h - r);
	ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}

/** Draw wrapped text from baseline `y`, ellipsising the last allowed line. Returns lines drawn. */
function drawLines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): number {
	const words = String(text || '').split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let line = '';
	let index = 0;
	for (; index < words.length; index += 1) {
		const next = line ? `${line} ${words[index]}` : words[index];
		if (ctx.measureText(next).width <= maxW || !line) {
			line = next;
			continue;
		}
		lines.push(line);
		line = words[index];
		if (lines.length === maxLines) break;
	}
	if (lines.length < maxLines && line) lines.push(line);
	if (index < words.length && lines.length) {
		let last = lines[lines.length - 1];
		while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1).trimEnd();
		lines[lines.length - 1] = `${last}…`;
	}
	lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
	return lines.length;
}

function setTracking(ctx: CanvasRenderingContext2D, value: string) {
	if ('letterSpacing' in ctx) ctx.letterSpacing = value;
}

function loadImage(src: string, timeout = 2500): Promise<HTMLImageElement> {
	const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
	const img = new Image();
	img.crossOrigin = 'anonymous';
	const timer = window.setTimeout(() => {
		img.src = '';
		reject(new Error('image timeout'));
	}, timeout);
	img.onload = () => {
		window.clearTimeout(timer);
		img.decode().catch(() => undefined).then(() => resolve(img));
	};
	img.onerror = () => {
		window.clearTimeout(timer);
		reject(new Error('image failed'));
	};
	img.src = src;
	return promise;
}

/**
 * The site's own logo, tinted for the footer medallion. Prefers the inline SVG
 * the layout injects from `config.logo` (exactly what the sidebar shows) and
 * falls back to `/favicon.svg`, which the metadata build renders from it.
 */
async function loadSiteLogo(color: string): Promise<HTMLImageElement | null> {
	const inline = document.querySelector('#site-logo-img svg, #site-logo-img-mobile svg');
	const markup = inline?.outerHTML
		?? await fetch('/favicon.svg').then((response) => (response.ok ? response.text() : '')).catch(() => '');
	if (!markup) return null;
	const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
	if (svg.nodeName !== 'svg') return null;
	svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	// Logos paint with `currentColor` (or a baked favicon fill); force the accent.
	svg.setAttribute('fill', color);
	svg.setAttribute('color', color);
	svg.setAttribute('width', '256');
	svg.setAttribute('height', '256');
	const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
	return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

async function loadOrnaments(): Promise<Ornaments> {
	const entries = await Promise.all(
		Object.entries(ORNAMENTS).map(([key, src]) => loadImage(src).then((img) => [key, img] as const).catch(() => null))
	);
	return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** Wait for the site's display and body faces so canvas text matches the page. */
async function loadFonts() {
	if (!document.fonts?.load) return;
	const { promise: timeout, resolve } = Promise.withResolvers<void>();
	const timer = window.setTimeout(resolve, 1500);
	await Promise.race([
		Promise.all([
			document.fonts.load(`600 64px ${DISPLAY}`),
			document.fonts.load(`italic 500 30px ${DISPLAY}`),
			document.fonts.load(`500 24px ${SANS}`),
			document.fonts.load(`700 16px ${SANS}`)
		]).catch(() => undefined),
		timeout
	]);
	window.clearTimeout(timer);
}

function readShareTheme(): ShareTheme {
	const dark = document.documentElement.getAttribute('data-theme') !== 'light';
	// Resolve --accent (any colour syntax) through computed style, normalised to sRGB.
	const probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;color:color-mix(in srgb, var(--accent) 100%, transparent)';
	document.body.append(probe);
	const accent = parseCssColor(getComputedStyle(probe).color, [183, 110, 0]);
	probe.remove();
	const white: Rgb = [255, 255, 255];
	return {
		dark,
		bg: dark ? [17, 19, 22] : [247, 246, 242],
		ink: dark ? [244, 238, 228] : [33, 26, 18],
		inkSoft: dark ? [203, 194, 180] : [79, 69, 55],
		accent,
		accentText: dark ? mixRgb(accent, white, 0.45) : mixRgb(accent, [0, 0, 0], 0.3),
		hi: mixRgb(accent, [255, 244, 220], 0.55),
		lo: mixRgb(accent, [18, 10, 2], dark ? 0.45 : 0.3),
		frost: dark ? 'rgba(24,26,31,0.6)' : 'rgba(255,255,255,0.62)',
		surface: dark ? rgba(mixRgb([30, 32, 38], accent, 0.06), 0.82) : rgba(mixRgb(white, accent, 0.04), 0.9),
		edge: rgba(mixRgb(accent, white, 0.1), dark ? 0.4 : 0.45),
		line: rgba(accent, 0.42),
		lineSoft: rgba(accent, 0.22),
		tint: rgba(accent, dark ? 0.14 : 0.1),
		carve: dark ? 0.75 : 0.66
	};
}

/** Accent metal: the same highlight → accent → shadow sweep the CSS ornaments use. */
function metalGradient(ctx: CanvasRenderingContext2D, theme: ShareTheme, x: number, y: number, w: number, h: number) {
	const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
	if (theme.dark) {
		gradient.addColorStop(0, rgba(theme.hi));
		gradient.addColorStop(0.38, rgba(theme.accent));
		gradient.addColorStop(0.62, rgba(theme.lo));
		gradient.addColorStop(1, rgba(theme.hi));
	} else {
		gradient.addColorStop(0, rgba(mixRgb(theme.accent, [255, 255, 255], 0.3)));
		gradient.addColorStop(0.4, rgba(theme.accent));
		gradient.addColorStop(1, rgba(theme.lo));
	}
	return gradient;
}

/** Paint a white alpha-mask ornament in accent metal. */
function drawCarved(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, theme: ShareTheme, x: number, y: number, w: number, h: number, alpha: number) {
	if (!img) return;
	const layer = document.createElement('canvas');
	layer.width = Math.ceil(w);
	layer.height = Math.ceil(h);
	const lctx = layer.getContext('2d');
	if (!lctx) return;
	lctx.drawImage(img, 0, 0, w, h);
	lctx.globalCompositeOperation = 'source-in';
	lctx.fillStyle = metalGradient(lctx, theme, 0, 0, w, h);
	lctx.fillRect(0, 0, w, h);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.drawImage(layer, x, y, w, h);
	ctx.restore();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const scale = Math.max(w / img.width, h / img.height);
	ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
}

/** Deterministic PRNG so one page always yields the same firefly layout. */
function seededRandom(seedText: string) {
	let seed = 2166136261;
	for (let i = 0; i < seedText.length; i += 1) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
	return () => {
		seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909);
		return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
	};
}

/** Theme canvas: optional blurred cover, accent light, masked dot grid and fireflies. */
function drawBackdrop(theme: ShareTheme, cover: HTMLImageElement | null, seedText: string): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return canvas;
	ctx.fillStyle = rgba(theme.bg);
	ctx.fillRect(0, 0, SIZE, SIZE);
	if (cover) {
		ctx.save();
		ctx.filter = 'blur(10px) saturate(1.15)';
		drawCover(ctx, cover, -20, -20, SIZE + 40, SIZE + 40);
		ctx.restore();
		ctx.fillStyle = rgba(theme.bg, theme.dark ? 0.62 : 0.56);
		ctx.fillRect(0, 0, SIZE, SIZE);
	}
	for (const [cx, cy, radius, alpha] of [[0.82, 0.08, 0.62, theme.dark ? 0.24 : 0.16], [0.14, 0.96, 0.5, theme.dark ? 0.14 : 0.1]]) {
		const glow = ctx.createRadialGradient(cx * SIZE, cy * SIZE, 0, cx * SIZE, cy * SIZE, radius * SIZE);
		glow.addColorStop(0, rgba(theme.accent, alpha));
		glow.addColorStop(1, rgba(theme.accent, 0));
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, SIZE, SIZE);
	}

	// Dot grid masked to an off-centre ellipse, like `.bg-gradient::before`.
	const dots = document.createElement('canvas');
	dots.width = dots.height = SIZE;
	const dctx = dots.getContext('2d');
	if (dctx) {
		dctx.fillStyle = rgba(theme.accent, theme.dark ? 0.34 : 0.3);
		dctx.beginPath();
		for (let y = 12; y < SIZE; y += 24) {
			for (let x = 12; x < SIZE; x += 24) {
				dctx.moveTo(x + 1.4, y);
				dctx.arc(x, y, 1.4, 0, Math.PI * 2);
			}
		}
		dctx.fill();
		dctx.globalCompositeOperation = 'destination-in';
		const mask = dctx.createRadialGradient(SIZE * 0.6, SIZE * 0.3, 0, SIZE * 0.6, SIZE * 0.3, SIZE * 0.85);
		mask.addColorStop(0.2, '#000');
		mask.addColorStop(0.65, 'rgba(0,0,0,0.35)');
		mask.addColorStop(1, 'rgba(0,0,0,0)');
		dctx.fillStyle = mask;
		dctx.fillRect(0, 0, SIZE, SIZE);
		ctx.drawImage(dots, 0, 0);
	}

	const random = seededRandom(seedText);
	const core = theme.dark ? mixRgb(theme.accent, [255, 248, 232], 0.7) : mixRgb(theme.accent, [255, 255, 255], 0.12);
	for (let i = 0; i < 12; i += 1) {
		const x = (0.04 + 0.92 * random()) * SIZE;
		const y = (0.04 + 0.92 * random()) * SIZE;
		const radius = 16 + random() * 30;
		const peak = (theme.dark ? 0.55 : 0.4) + random() * 0.4;
		const fly = ctx.createRadialGradient(x, y, 0, x, y, radius);
		fly.addColorStop(0, rgba(core, peak));
		fly.addColorStop(0.18, rgba(theme.accent, peak * 0.8));
		fly.addColorStop(0.45, rgba(theme.accent, peak * 0.3));
		fly.addColorStop(1, rgba(theme.accent, 0));
		ctx.fillStyle = fly;
		ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}
	return canvas;
}

/** Frosted plate: blurred backdrop behind a tinted fill, diagonal sheen and lit rim. */
function drawGlass(ctx: CanvasRenderingContext2D, backdrop: HTMLCanvasElement, rect: Rect, theme: ShareTheme) {
	const { x, y, w, h, r } = rect;
	ctx.save();
	ctx.shadowColor = theme.dark ? 'rgba(0,0,0,0.55)' : 'rgba(70,50,25,0.22)';
	ctx.shadowBlur = 70;
	ctx.shadowOffsetY = 28;
	roundRect(ctx, x, y, w, h, r);
	ctx.fillStyle = rgba(theme.bg);
	ctx.fill();
	ctx.restore();

	ctx.save();
	roundRect(ctx, x, y, w, h, r);
	ctx.clip();
	ctx.filter = 'blur(28px) saturate(1.6)';
	ctx.drawImage(backdrop, 0, 0);
	ctx.filter = 'none';
	ctx.fillStyle = theme.frost;
	ctx.fillRect(x, y, w, h);
	const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
	const stops = theme.dark ? [0.09, 0.02, 0, 0.03] : [0.72, 0.18, 0, 0.28];
	[0, 0.34, 0.58, 1].forEach((at, i) => sheen.addColorStop(at, `rgba(255,255,255,${stops[i]})`));
	ctx.fillStyle = sheen;
	ctx.fillRect(x, y, w, h);
	ctx.restore();

	ctx.lineWidth = 1.5;
	ctx.strokeStyle = theme.edge;
	roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
	ctx.stroke();
	const rim = ctx.createLinearGradient(0, y, 0, y + 80);
	rim.addColorStop(0, theme.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)');
	rim.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.strokeStyle = rim;
	roundRect(ctx, x + 2, y + 2, w - 4, h - 4, r - 2);
	ctx.stroke();
}

function drawFrameOrnaments(ctx: CanvasRenderingContext2D, ornaments: Ornaments, theme: ShareTheme) {
	const corner = 136;
	const { x, y, w, h } = CARD;
	drawCarved(ctx, ornaments.tl, theme, x, y, corner, corner, theme.carve);
	drawCarved(ctx, ornaments.tr, theme, x + w - corner, y, corner, corner, theme.carve);
	drawCarved(ctx, ornaments.bl, theme, x, y + h - corner, corner, corner, theme.carve);
	drawCarved(ctx, ornaments.br, theme, x + w - corner, y + h - corner, corner, corner, theme.carve);
	const spineH = 190;
	drawCarved(ctx, ornaments.side, theme, x + 8, y + (h - spineH) / 2, 18, spineH, theme.carve * 0.8);
	drawCarved(ctx, ornaments.side, theme, x + w - 26, y + (h - spineH) / 2, 18, spineH, theme.carve * 0.8);
}

/** Hairline + tracked uppercase label, matching the hero eyebrow. */
function drawEyebrow(ctx: CanvasRenderingContext2D, theme: ShareTheme, text: string, x: number, y: number, align: CanvasTextAlign = 'left') {
	ctx.save();
	ctx.font = `700 17px ${SANS}`;
	setTracking(ctx, '0.24em');
	const label = text.toUpperCase();
	const textW = ctx.measureText(label).width;
	const lineX = align === 'center' ? x - (textW + 48) / 2 : x;
	ctx.fillStyle = rgba(theme.accentText, 0.75);
	ctx.fillRect(lineX, y - 7, 34, 1.5);
	ctx.fillStyle = rgba(theme.accentText);
	ctx.textAlign = 'left';
	ctx.fillText(label, lineX + 48, y);
	ctx.restore();
}

/** Carved divider (or a fading hairline if the mask is unavailable). Returns its height. */
function drawDivider(ctx: CanvasRenderingContext2D, ornaments: Ornaments, theme: ShareTheme, x: number, y: number, w = 210): number {
	const h = Math.round((w * 117) / 720);
	if (ornaments.divider) {
		drawCarved(ctx, ornaments.divider, theme, x, y, w, h, 0.9);
		return h;
	}
	const line = ctx.createLinearGradient(x, 0, x + w, 0);
	line.addColorStop(0, rgba(theme.accentText, 0.8));
	line.addColorStop(1, rgba(theme.accentText, 0));
	ctx.fillStyle = line;
	ctx.fillRect(x, y + h / 2, w, 1.5);
	return h;
}

function drawTags(ctx: CanvasRenderingContext2D, theme: ShareTheme, tags: string[], x: number, y: number, maxW: number) {
	ctx.save();
	ctx.font = `600 18px ${SANS}`;
	let tx = x;
	for (const tag of tags.slice(0, 5)) {
		const w = ctx.measureText(tag).width + 36;
		if (tx + w > x + maxW) break;
		roundRect(ctx, tx, y, w, 40, 20);
		ctx.fillStyle = theme.tint;
		ctx.fill();
		ctx.strokeStyle = theme.lineSoft;
		ctx.lineWidth = 1.2;
		ctx.stroke();
		ctx.fillStyle = rgba(theme.ink);
		ctx.fillText(tag, tx + 18, y + 27);
		tx += w + 10;
	}
	ctx.restore();
}

/** Photo with a thin accent edge, as in the site's thumbnail wells. */
function drawPhoto(ctx: CanvasRenderingContext2D, theme: ShareTheme, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
	ctx.save();
	roundRect(ctx, x, y, w, h, r);
	ctx.clip();
	drawCover(ctx, img, x, y, w, h);
	ctx.restore();
	ctx.strokeStyle = theme.lineSoft;
	ctx.lineWidth = 1.5;
	roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
	ctx.stroke();
}

/** Painted (blur-free) glass row used for list items inside the plate. */
function drawRow(ctx: CanvasRenderingContext2D, theme: ShareTheme, x: number, y: number, w: number, h: number) {
	roundRect(ctx, x, y, w, h, 20);
	ctx.fillStyle = theme.surface;
	ctx.fill();
	const sheen = ctx.createLinearGradient(0, y, 0, y + h);
	sheen.addColorStop(0, theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)');
	sheen.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = sheen;
	ctx.fill();
	ctx.strokeStyle = theme.lineSoft;
	ctx.lineWidth = 1.2;
	ctx.stroke();
}

function drawMedallion(ctx: CanvasRenderingContext2D, theme: ShareTheme, cx: number, cy: number, radius: number) {
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.fillStyle = theme.dark ? rgba(mixRgb([30, 32, 38], theme.accent, 0.08)) : '#fffdf8';
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = metalGradient(ctx, theme, cx - radius, cy - radius, radius * 2, radius * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
	ctx.lineWidth = 1;
	ctx.strokeStyle = theme.lineSoft;
	ctx.stroke();
}

function abbreviation(title: string): string {
	const words = title.split(/[\s-]+/).filter(Boolean);
	return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || title.slice(0, 2).toUpperCase() || 'R';
}

function drawFooter(ctx: CanvasRenderingContext2D, theme: ShareTheme, logo: HTMLImageElement | null, label: string, meta: string, url: string) {
	const line = ctx.createLinearGradient(INNER_X, 0, INNER_X + INNER_W, 0);
	line.addColorStop(0, rgba(theme.accentText, 0));
	line.addColorStop(0.5, rgba(theme.accentText, 0.55));
	line.addColorStop(1, rgba(theme.accentText, 0));
	ctx.fillStyle = line;
	ctx.fillRect(INNER_X, FOOTER_LINE, INNER_W, 1.5);

	const radius = 34;
	const cx = INNER_X + radius;
	const cy = FOOTER_LINE + 28 + radius;
	drawMedallion(ctx, theme, cx, cy, radius);
	if (logo) ctx.drawImage(logo, cx - 20, cy - 20, 40, 40);

	ctx.textAlign = 'left';
	ctx.fillStyle = rgba(theme.ink);
	ctx.font = `600 34px ${DISPLAY}`;
	drawLines(ctx, label, cx + radius + 22, meta ? cy - 2 : cy + 11, INNER_W * 0.5, 34, 1);
	if (meta) {
		ctx.font = `500 18px ${SANS}`;
		ctx.fillStyle = rgba(theme.inkSoft);
		drawLines(ctx, meta, cx + radius + 22, cy + 26, INNER_W * 0.5, 22, 1);
	}
	let host = '';
	try {
		host = new URL(url).host.replace(/^www\./, '');
	} catch {
		host = location.host;
	}
	ctx.font = `600 18px ${SANS}`;
	setTracking(ctx, '0.08em');
	ctx.fillStyle = rgba(theme.accentText);
	ctx.textAlign = 'right';
	ctx.fillText(host, INNER_X + INNER_W, cy + 7);
	setTracking(ctx, '0px');
	ctx.textAlign = 'left';
}

const plural = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;

export async function generateShareImage(payload: SharePayload): Promise<Blob | null> {
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const theme = readShareTheme();
	const [ornaments, logo, cover, avatar, galleryImages] = await Promise.all([
		loadOrnaments(),
		loadSiteLogo(rgba(theme.accentText)).catch(() => null),
		payload.coverUrl ? loadImage(assetUrl(payload.coverUrl)).catch(() => null) : null,
		payload.avatarUrl ? loadImage(assetUrl(payload.avatarUrl)).catch(() => null) : null,
		Promise.all((payload.galleryImageUrls ?? []).slice(0, 3).map((url) => loadImage(assetUrl(url)).catch(() => null))),
		loadFonts()
	]);
	const photos = galleryImages.filter((img): img is HTMLImageElement => img !== null);

	const backdrop = drawBackdrop(theme, cover ?? photos[0] ?? null, payload.title || 'Readynaz');
	ctx.drawImage(backdrop, 0, 0);
	drawGlass(ctx, backdrop, CARD, theme);
	drawFrameOrnaments(ctx, ornaments, theme);
	ctx.textBaseline = 'alphabetic';

	const author = payload.author || 'Readynaz';
	const url = payload.url ?? location.href;
	const finish = (label: string, meta: string) => {
		drawFooter(ctx, theme, logo, label, meta, url);
		const { promise, resolve } = Promise.withResolvers<Blob | null>();
		canvas.toBlob(resolve, 'image/png');
		return promise;
	};

	if (payload.variant === 'profile') {
		const band = { x: CARD.x + 14, y: CARD.y + 14, w: CARD.w - 28, h: 260 };
		if (cover) {
			ctx.save();
			roundRect(ctx, band.x, band.y, band.w, band.h, CARD.r - 12);
			ctx.clip();
			drawCover(ctx, cover, band.x, band.y, band.w, band.h);
			const fade = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
			fade.addColorStop(0.35, rgba(theme.bg, 0));
			fade.addColorStop(1, rgba(theme.bg, 0.88));
			ctx.fillStyle = fade;
			ctx.fillRect(band.x, band.y, band.w, band.h);
			ctx.restore();
		}
		const center = SIZE / 2;
		const avatarR = 100;
		const avatarY = band.y + band.h - 10;
		drawMedallion(ctx, theme, center, avatarY, avatarR + 6);
		if (avatar) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(center, avatarY, avatarR, 0, Math.PI * 2);
			ctx.clip();
			drawCover(ctx, avatar, center - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
			ctx.restore();
		} else {
			ctx.font = `600 72px ${DISPLAY}`;
			ctx.fillStyle = rgba(theme.accentText);
			ctx.textAlign = 'center';
			ctx.fillText(abbreviation(payload.title), center, avatarY + 24);
		}
		ctx.textAlign = 'center';
		ctx.font = `600 66px ${DISPLAY}`;
		ctx.fillStyle = rgba(theme.ink);
		let y = avatarY + avatarR + 76;
		ctx.fillText(payload.title, center, y);
		if (payload.role) {
			ctx.font = `500 24px ${SANS}`;
			ctx.fillStyle = rgba(theme.inkSoft);
			y += 40;
			ctx.fillText(payload.role, center, y);
		}
		ctx.textAlign = 'left';
		y += 26;
		y += drawDivider(ctx, ornaments, theme, center - 105, y) + 26;
		for (const meta of (payload.metadata ?? []).slice(0, 3)) {
			if (y + 54 > CONTENT_BOTTOM) break;
			const label = (meta.label ?? '').toUpperCase();
			const value = meta.value ?? '';
			ctx.font = `700 15px ${SANS}`;
			setTracking(ctx, '0.18em');
			const labelW = label ? ctx.measureText(label).width + 16 : 0;
			setTracking(ctx, '0px');
			ctx.font = `600 21px ${SANS}`;
			const w = Math.min(INNER_W, labelW + ctx.measureText(value).width + 52);
			const x = center - w / 2;
			drawRow(ctx, theme, x, y, w, 54);
			if (label) {
				ctx.font = `700 15px ${SANS}`;
				setTracking(ctx, '0.18em');
				ctx.fillStyle = rgba(theme.accentText);
				ctx.fillText(label, x + 26, y + 33);
				setTracking(ctx, '0px');
			}
			ctx.font = `600 21px ${SANS}`;
			ctx.fillStyle = rgba(theme.ink);
			drawLines(ctx, value, x + 26 + labelW, y + 34, w - 52 - labelW, 24, 1);
			y += 68;
		}
		return finish(author, 'Profile');
	}

	if (payload.variant === 'directory' || payload.variant === 'thoughts') {
		const thoughts = payload.variant === 'thoughts';
		const projects = payload.pageLabel === 'project';
		const items = (payload.itemTitles ?? []).slice(0, 4);
		const count = payload.pageCount ?? items.length;
		const label = thoughts ? 'thought' : payload.pageLabel ?? 'item';

		let y = CONTENT_TOP + 30;
		drawEyebrow(ctx, theme, plural(count, label), INNER_X, y);
		y += 70;
		ctx.font = `600 78px ${DISPLAY}`;
		ctx.fillStyle = rgba(theme.ink);
		y += drawLines(ctx, payload.title, INNER_X, y, INNER_W, 80, 2) * 80 - 50;
		y += drawDivider(ctx, ornaments, theme, INNER_X, y) + 24;
		const rowH = 82;
		const gap = 14;
		const listTop = CONTENT_BOTTOM - items.length * (rowH + gap) + gap;
		if (payload.summary) {
			ctx.font = `400 24px ${SANS}`;
			ctx.fillStyle = rgba(theme.inkSoft);
			const room = Math.max(0, Math.floor((listTop - 24 - y) / 36));
			if (room) drawLines(ctx, payload.summary, INNER_X, y + 24, INNER_W, 36, Math.min(2, room));
		}
		items.forEach((title, i) => {
			const rowY = listTop + i * (rowH + gap);
			drawRow(ctx, theme, INNER_X, rowY, INNER_W, rowH);
			const mid = rowY + rowH / 2;
			if (projects) {
				drawMedallion(ctx, theme, INNER_X + 46, mid, 22);
				ctx.font = `600 20px ${DISPLAY}`;
				ctx.fillStyle = rgba(theme.accentText);
				ctx.textAlign = 'center';
				ctx.fillText(abbreviation(title), INNER_X + 46, mid + 7);
				ctx.textAlign = 'left';
			} else {
				ctx.font = thoughts ? `600 64px ${DISPLAY}` : `600 34px ${DISPLAY}`;
				ctx.fillStyle = rgba(theme.accentText);
				ctx.fillText(thoughts ? '\u201C' : String(i + 1).padStart(2, '0'), INNER_X + 26, thoughts ? mid + 30 : mid + 12);
			}
			ctx.font = thoughts ? `italic 500 30px ${DISPLAY}` : `600 23px ${SANS}`;
			ctx.fillStyle = rgba(theme.ink);
			drawLines(ctx, title, INNER_X + 92, mid + (thoughts ? 10 : 8), INNER_W - 120, 30, 1);
		});
		return finish(author, plural(count, label));
	}

	if (payload.variant === 'gallery-item') {
		const img = photos[0] ?? cover;
		let y = CONTENT_TOP;
		if (img) {
			drawPhoto(ctx, theme, img, INNER_X, y, INNER_W, 470, 26);
			y += 470 + 58;
		} else {
			y += 40;
		}
		drawEyebrow(ctx, theme, 'Gallery', INNER_X, y);
		y += 62;
		ctx.font = `600 58px ${DISPLAY}`;
		ctx.fillStyle = rgba(theme.ink);
		y += drawLines(ctx, payload.title, INNER_X, y, INNER_W, 62, 2) * 62 - 20;
		if (payload.summary && y + 30 < CONTENT_BOTTOM) {
			ctx.font = `400 24px ${SANS}`;
			ctx.fillStyle = rgba(theme.inkSoft);
			drawLines(ctx, payload.summary, INNER_X, y + 22, INNER_W, 36, Math.max(1, Math.min(2, Math.floor((CONTENT_BOTTOM - y) / 36))));
		}
		return finish(author, [payload.date].filter(Boolean).join(' · ') || 'Gallery');
	}

	if (payload.variant === 'gallery') {
		const count = payload.pageCount ?? photos.length;
		let y = CONTENT_TOP + 30;
		drawEyebrow(ctx, theme, plural(count, 'photo'), INNER_X, y);
		y += 70;
		ctx.font = `600 78px ${DISPLAY}`;
		ctx.fillStyle = rgba(theme.ink);
		y += drawLines(ctx, payload.title, INNER_X, y, INNER_W, 80, 1) * 80 - 50;
		y += drawDivider(ctx, ornaments, theme, INNER_X, y) + 34;
		const fan = photos.length ? photos : cover ? [cover] : [];
		const frameW = 520;
		const frameH = Math.min(380, CONTENT_BOTTOM - y - 20);
		const cx = SIZE / 2;
		const cy = y + frameH / 2 + 10;
		const layout = [
			{ dx: -150, dy: 18, rot: -0.09 },
			{ dx: 150, dy: 14, rot: 0.08 },
			{ dx: 0, dy: 0, rot: 0 }
		];
		// Always fan three frames; with fewer photos the back frames repeat them.
		layout.forEach((slot, i) => {
			const img = fan.length ? fan[(2 - i) % fan.length] : undefined;
			ctx.save();
			ctx.translate(cx + slot.dx, cy + slot.dy);
			ctx.rotate(slot.rot);
			ctx.shadowColor = theme.dark ? 'rgba(0,0,0,0.5)' : 'rgba(70,50,25,0.25)';
			ctx.shadowBlur = 36;
			ctx.shadowOffsetY = 18;
			roundRect(ctx, -frameW / 2, -frameH / 2, frameW, frameH, 24);
			ctx.fillStyle = theme.dark ? rgba(mixRgb([30, 32, 38], theme.accent, 0.08)) : '#fffdf8';
			ctx.fill();
			ctx.shadowColor = 'transparent';
			ctx.lineWidth = 2;
			ctx.strokeStyle = metalGradient(ctx, theme, -frameW / 2, -frameH / 2, frameW, frameH);
			ctx.stroke();
			if (img) drawPhoto(ctx, theme, img, -frameW / 2 + 12, -frameH / 2 + 12, frameW - 24, frameH - 24, 16);
			ctx.restore();
		});
		return finish(author, 'Gallery');
	}

	// Article / portfolio detail.
	const portfolio = payload.variant === 'portfolio-detail';
	let y = CONTENT_TOP;
	if (cover) {
		drawPhoto(ctx, theme, cover, INNER_X, y, INNER_W, 300, 26);
		y += 300 + 58;
	} else {
		y += 44;
	}
	drawEyebrow(ctx, theme, portfolio ? 'Portfolio' : 'Blog', INNER_X, y);
	y += cover ? 64 : 84;
	const titleSize = cover ? 60 : 76;
	ctx.font = `600 ${titleSize}px ${DISPLAY}`;
	ctx.fillStyle = rgba(theme.ink);
	y += drawLines(ctx, payload.title, INNER_X, y, INNER_W, titleSize * 1.08, cover ? 2 : 3) * titleSize * 1.08 - titleSize * 0.7;
	y += drawDivider(ctx, ornaments, theme, INNER_X, y) + 18;
	const tagsY = CONTENT_BOTTOM - 40;
	const hasTags = Boolean(payload.tags?.length);
	if (payload.summary) {
		ctx.font = `400 25px ${SANS}`;
		ctx.fillStyle = rgba(theme.inkSoft);
		const room = Math.floor(((hasTags ? tagsY - 20 : CONTENT_BOTTOM) - y) / 38);
		if (room > 0) drawLines(ctx, payload.summary, INNER_X, y + 26, INNER_W, 38, Math.min(cover ? 2 : 3, room));
	}
	if (hasTags) drawTags(ctx, theme, payload.tags ?? [], INNER_X, tagsY, INNER_W);
	return finish(author, payload.date || (portfolio ? 'Portfolio' : 'Readynaz'));
}

export async function shareContent(payload: SharePayload): Promise<boolean> {
	const url = payload.url ?? location.href;
	const text = payload.summary || payload.title;
	const labelText = payload.title ? `${payload.title}\n${url}` : url;

	try {
		if (navigator.share) {
			if (isMobileShareDevice()) {
				const blob = await generateShareImage({ ...payload, url });
				if (blob) {
					const file = new File([blob], 'share.png', { type: 'image/png' });
					if (navigator.canShare?.({ files: [file] })) {
						await navigator.share({ title: payload.title, text: labelText, files: [file] });
						return true;
					}
				}
			}
			await navigator.share({ title: payload.title, text, url });
			return true;
		}
		const blob = await generateShareImage({ ...payload, url });
		if (blob && 'ClipboardItem' in window && navigator.clipboard?.write) {
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': new Blob([labelText], { type: 'text/plain' }),
					'image/png': blob,
				}),
			]);
			return true;
		}
		await navigator.clipboard?.writeText(labelText);
		return true;
	} catch {
		return false;
	}
}
