import { assetUrl } from '$lib/utils';

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

const SIZE = 1080;

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

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): number {
	const words = String(text || '').split(/\s+/).filter(Boolean);
	let line = '';
	const lines: string[] = [];
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (ctx.measureText(next).width > maxW && line) {
			if (lines.length >= maxLines - 1) {
				lines.push(`${line}...`);
				line = '';
				break;
			}
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
	return lines.length;
}

function loadImage(url: string, timeout = 2200): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		const timer = window.setTimeout(() => {
			img.src = '';
			reject(new Error('image timeout'));
		}, timeout);
		img.onload = () => {
			window.clearTimeout(timer);
			resolve(img);
		};
		img.onerror = () => {
			window.clearTimeout(timer);
			reject(new Error('image failed'));
		};
		img.src = assetUrl(url);
	});
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, filter = '') {
	ctx.save();
	if (filter) ctx.filter = filter;
	const scale = Math.max(w / img.width, h / img.height);
	ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
	ctx.restore();
}

function drawShareBackdrop(ctx: CanvasRenderingContext2D, cover: HTMLImageElement | null, accent1: string, accent2: string) {
	if (cover) {
		drawCoverImage(ctx, cover, 0, 0, SIZE, SIZE, 'blur(8px) brightness(0.34) saturate(1.12)');
		ctx.fillStyle = 'rgba(2,6,23,0.54)';
		ctx.fillRect(0, 0, SIZE, SIZE);
		return;
	}
	const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
	bg.addColorStop(0, '#030712');
	bg.addColorStop(0.58, '#0f172a');
	bg.addColorStop(1, '#020617');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ctx.globalAlpha = 0.28;
	let glow = ctx.createRadialGradient(SIZE * 0.2, SIZE * 0.18, 0, SIZE * 0.2, SIZE * 0.18, SIZE * 0.46);
	glow.addColorStop(0, accent1);
	glow.addColorStop(1, 'transparent');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, SIZE, SIZE);
	glow = ctx.createRadialGradient(SIZE * 0.85, SIZE * 0.82, 0, SIZE * 0.85, SIZE * 0.82, SIZE * 0.38);
	glow.addColorStop(0, accent2);
	glow.addColorStop(1, 'transparent');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ctx.globalAlpha = 1;
}

function abbreviation(title: string): string {
	const words = title.split(/[\s-]+/).filter(Boolean);
	const letters = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
	return letters || title.slice(0, 2).toUpperCase() || 'R';
}

function createLogoImage(color: string): Promise<HTMLImageElement> {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -10 124 120" fill="${color}" stroke="${color}"><path d="M50 8 L8 50 L50 92 L92 50" stroke-width="10" stroke-linejoin="miter" stroke-linecap="butt" fill="none"/><path d="M 50 8 L 68 26" stroke-width="10" stroke-linecap="butt" fill="none"/><rect x="52" y="45" width="40" height="10" stroke="none"/><path d="M 35 22 C 22 8, 6 -2, -8 -4 C -4 4, 10 18, 26 32 Z" stroke="none"/><path d="M 26 68 C 10 84, -4 96, -8 104 C 4 96, 18 82, 35 78 Z" stroke="none"/></svg>`;
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('logo failed'));
		};
		img.src = url;
	});
}

function drawStandardFooter(
	ctx: CanvasRenderingContext2D,
	card: { x: number; y: number; w: number; h: number; r: number },
	logo: HTMLImageElement | null,
	accent1: string,
	label: string,
	meta?: string
) {
	const footerH = 126;
	const footerY = card.y + card.h - footerH;
	ctx.save();
	roundRect(ctx, card.x, card.y, card.w, card.h, card.r);
	ctx.clip();
	const grad = ctx.createLinearGradient(card.x, footerY, card.x + card.w, footerY + footerH);
	grad.addColorStop(0, '#0f172a');
	grad.addColorStop(1, '#020617');
	ctx.fillStyle = grad;
	ctx.fillRect(card.x, footerY, card.w, footerH);
	ctx.fillStyle = 'rgba(255,255,255,0.08)';
	ctx.fillRect(card.x, footerY, card.w, 1);
	ctx.restore();

	ctx.font = '800 30px Inter, system-ui, sans-serif';
	ctx.fillStyle = '#fff';
	ctx.fillText(label, card.x + 58, footerY + 76);
	if (meta) {
		ctx.font = '600 17px Inter, system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.62)';
		ctx.fillText(meta, card.x + 58, footerY + 100);
	}
	if (logo) ctx.drawImage(logo, card.x + card.w - 90, footerY + 48, 38, 38);
	else {
		ctx.fillStyle = accent1;
		roundRect(ctx, card.x + card.w - 90, footerY + 48, 38, 38, 9);
		ctx.fill();
	}
}

function drawImageCoverRounded(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
	ctx.save();
	roundRect(ctx, x, y, w, h, r);
	ctx.clip();
	const scale = Math.max(w / img.width, h / img.height);
	ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
	ctx.restore();
}

function drawGalleryHomeStack(
	ctx: CanvasRenderingContext2D,
	imgs: HTMLImageElement[],
	x: number,
	y: number,
	w: number,
	h: number,
	accent1: string
) {
	ctx.save();
	ctx.shadowColor = 'rgba(15,23,42,0.16)';
	ctx.shadowBlur = 34;
	ctx.shadowOffsetY = 18;
	roundRect(ctx, x, y, w, h, 28);
	ctx.fillStyle = '#f8fafc';
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = 'rgba(148,163,184,0.28)';
	ctx.lineWidth = 2;
	roundRect(ctx, x, y, w, h, 28);
	ctx.stroke();

	const chromeH = 72;
	ctx.save();
	roundRect(ctx, x, y, w, h, 28);
	ctx.clip();
	ctx.fillStyle = '#f8fafc';
	ctx.fillRect(x, y, w, chromeH);
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(x, y + chromeH, w, h - chromeH);
	ctx.restore();

	const dotY = y + 36;
	['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
		ctx.beginPath();
		ctx.arc(x + 36 + i * 24, dotY, 8, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
	});
	const img = imgs[0];
	const mainW = w * 0.76;
	const mainH = h * 0.58;
	const cx = x + w / 2;
	const cy = y + chromeH + (h - chromeH) / 2 + 12;
	const layers = [
		{ dx: -50, dy: 38, rot: -0.07, alpha: 0.22, scale: 0.96 },
		{ dx: 50, dy: 30, rot: 0.06, alpha: 0.26, scale: 0.96 },
		{ dx: 0, dy: 0, rot: 0, alpha: 1, scale: 1 }
	];
	for (const layer of layers) {
		const lw = mainW * layer.scale;
		const lh = mainH * layer.scale;
		ctx.save();
		ctx.translate(cx + layer.dx, cy + layer.dy);
		ctx.rotate(layer.rot);
		ctx.globalAlpha = layer.alpha;
		ctx.shadowColor = 'rgba(15,23,42,0.18)';
		ctx.shadowBlur = 24;
		ctx.shadowOffsetY = 14;
		roundRect(ctx, -lw / 2, -lh / 2, lw, lh, 22);
		ctx.fillStyle = '#e2e8f0';
		ctx.fill();
		if (img) {
			ctx.clip();
			const scale = Math.max(lw / img.width, lh / img.height);
			ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
		} else {
			ctx.fillStyle = accent1;
			ctx.globalAlpha = layer.alpha * 0.35;
			ctx.fillRect(-lw / 2, -lh / 2, lw, lh);
		}
		ctx.restore();
	}
}

function drawArticleStack(
	ctx: CanvasRenderingContext2D,
	items: string[],
	x: number,
	y: number,
	w: number,
	accent1: string
) {
	const gap = 22;
	const cardW = (w - gap) / 2;
	const cardH = 205;
	for (let i = 0; i < 4; i++) {
		const title = items[i] ?? 'Article';
		const cx = x + (i % 2) * (cardW + gap);
		const cy = y + Math.floor(i / 2) * (cardH + gap);
		ctx.save();
		ctx.shadowColor = 'rgba(15,23,42,0.12)';
		ctx.shadowBlur = 22;
		ctx.shadowOffsetY = 12;
		roundRect(ctx, cx, cy, cardW, cardH, 22);
		ctx.fillStyle = '#f8fafc';
		ctx.fill();
		ctx.restore();
		ctx.strokeStyle = 'rgba(148,163,184,0.38)';
		ctx.lineWidth = 1.5;
		roundRect(ctx, cx, cy, cardW, cardH, 22);
		ctx.stroke();
		ctx.fillStyle = accent1;
		roundRect(ctx, cx, cy, cardW, 8, 4);
		ctx.fill();
		ctx.font = '800 25px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#0f172a';
		wrapText(ctx, title, cx + 24, cy + 58, cardW - 48, 31, 3);
		ctx.fillStyle = 'rgba(15,23,42,0.10)';
		roundRect(ctx, cx + 24, cy + 150, cardW * 0.58, 10, 5);
		ctx.fill();
		roundRect(ctx, cx + 24, cy + 174, cardW * 0.42, 10, 5);
		ctx.fill();
	}
}

function drawPortfolioShowcase(
	ctx: CanvasRenderingContext2D,
	items: string[],
	x: number,
	y: number,
	w: number,
	h: number,
	accent1: string,
	accent2: string
) {
	ctx.save();
	ctx.shadowColor = 'rgba(15,23,42,0.14)';
	ctx.shadowBlur = 28;
	ctx.shadowOffsetY = 16;
	roundRect(ctx, x, y, w, h, 28);
	ctx.fillStyle = '#f8fafc';
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = 'rgba(148,163,184,0.30)';
	ctx.lineWidth = 2;
	roundRect(ctx, x, y, w, h, 28);
	ctx.stroke();

	const gap = 22;
	const tileW = (w - gap * 3) / 2;
	const tileH = (h - gap * 3) / 2;
	for (let i = 0; i < 4; i++) {
		const tx = x + gap + (i % 2) * (tileW + gap);
		const ty = y + gap + Math.floor(i / 2) * (tileH + gap);
		const title = items[i] ?? 'Project';
		ctx.save();
		ctx.shadowColor = 'rgba(15,23,42,0.12)';
		ctx.shadowBlur = 18;
		ctx.shadowOffsetY = 10;
		roundRect(ctx, tx, ty, tileW, tileH, 22);
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.restore();
		ctx.strokeStyle = 'rgba(148,163,184,0.25)';
		ctx.lineWidth = 1;
		roundRect(ctx, tx, ty, tileW, tileH, 22);
		ctx.stroke();

		const iconSize = 92;
		const grad = ctx.createLinearGradient(tx + 22, ty + 22, tx + iconSize, ty + iconSize);
		grad.addColorStop(0, accent1);
		grad.addColorStop(1, accent2);
		roundRect(ctx, tx + 24, ty + 24, iconSize, iconSize, 24);
		ctx.fillStyle = grad;
		ctx.fill();
		ctx.fillStyle = 'rgba(255,255,255,0.18)';
		ctx.beginPath();
		ctx.arc(tx + 98, ty + 44, 32, 0, Math.PI * 2);
		ctx.fill();
		ctx.font = '900 38px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'center';
		ctx.fillText(abbreviation(title), tx + 70, ty + 82);
		ctx.textAlign = 'left';

		ctx.font = '800 23px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#0f172a';
		wrapText(ctx, title, tx + 136, ty + 55, tileW - 158, 28, 2);
		ctx.fillStyle = 'rgba(15,23,42,0.10)';
		roundRect(ctx, tx + 136, ty + 116, tileW - 176, 9, 5);
		ctx.fill();
		roundRect(ctx, tx + 136, ty + 136, tileW - 210, 9, 5);
		ctx.fill();
	}
}

function drawThinkingIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, accent1: string, accent2: string) {
	const r = size / 2;
	ctx.save();
	ctx.shadowColor = 'rgba(15,23,42,0.14)';
	ctx.shadowBlur = 34;
	ctx.shadowOffsetY = 16;
	const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
	grad.addColorStop(0, accent1);
	grad.addColorStop(1, accent2);
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.strokeStyle = 'rgba(255,255,255,0.9)';
	ctx.lineWidth = 11;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.arc(x - 24, y - 8, 52, Math.PI * 0.18, Math.PI * 1.18);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + 10, y + 44);
	ctx.quadraticCurveTo(x + 54, y + 12, x + 26, y - 26);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(x - 34, y - 24, 6, 0, Math.PI * 2);
	ctx.arc(x + 20, y - 36, 6, 0, Math.PI * 2);
	ctx.fillStyle = '#fff';
	ctx.fill();
	ctx.font = '900 84px Inter, system-ui, sans-serif';
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.fillText('?', x + 28, y + 42);
	ctx.textAlign = 'left';
}

export async function generateShareImage(payload: SharePayload): Promise<Blob | null> {
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const cs = getComputedStyle(document.documentElement);
	const accent1 = cs.getPropertyValue('--gradient-1').trim() || '#22c55e';
	const accent2 = cs.getPropertyValue('--gradient-2').trim() || '#10b981';
	const results = await Promise.allSettled([
		createLogoImage(accent1),
		payload.coverUrl ? loadImage(payload.coverUrl) : Promise.reject(),
		payload.avatarUrl ? loadImage(payload.avatarUrl) : Promise.reject(),
		Promise.all((payload.galleryImageUrls ?? []).slice(0, 4).map((url) => loadImage(url).catch(() => null))),
	]);
	const logo = results[0].status === 'fulfilled' ? results[0].value as HTMLImageElement : null;
	const cover = results[1].status === 'fulfilled' ? results[1].value as HTMLImageElement : null;
	const avatar = results[2].status === 'fulfilled' ? results[2].value as HTMLImageElement : null;
	const galleryImages = results[3].status === 'fulfilled' ? results[3].value as Array<HTMLImageElement | null> : [];

	drawShareBackdrop(ctx, cover, accent1, accent2);
	const margin = 18;
	const cardW = SIZE - margin * 2;
	const cardH = SIZE - margin * 2;
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.42)';
	ctx.shadowBlur = 54;
	ctx.shadowOffsetY = 12;
	roundRect(ctx, margin, margin, cardW, cardH, 18);
	ctx.fillStyle = 'rgba(255,255,255,0.96)';
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = 'rgba(255,255,255,0.22)';
	ctx.lineWidth = 1.5;
	roundRect(ctx, margin, margin, cardW, cardH, 18);
	ctx.stroke();

	const gradient = ctx.createLinearGradient(margin, margin, margin, SIZE - margin);
	gradient.addColorStop(0, accent1);
	gradient.addColorStop(1, accent2);
	roundRect(ctx, margin, margin + 18, 6, cardH - 36, 3);
	ctx.fillStyle = gradient;
	ctx.fill();

	const pad = 58;
	const titleX = margin + pad + 6;
	let titleY = margin + pad + 72;
	const titleW = cardW - pad * 2 - 6;
	const standardCard = { x: margin, y: margin, w: cardW, h: cardH, r: 18 };

	if (payload.variant === 'profile') {
		const coverH = 360;
		if (cover) {
			drawImageCoverRounded(ctx, cover, margin + 18, margin + 18, cardW - 36, coverH, 18);
			ctx.fillStyle = 'rgba(15,23,42,0.24)';
			ctx.fillRect(margin + 18, margin + 18, cardW - 36, coverH);
		}
		ctx.save();
		ctx.shadowColor = 'rgba(15,23,42,0.12)';
		ctx.shadowBlur = 24;
		ctx.shadowOffsetY = 14;
		roundRect(ctx, margin + 62, margin + 300, cardW - 124, 520, 26);
		ctx.fillStyle = 'rgba(255,255,255,0.96)';
		ctx.fill();
		ctx.restore();
		const center = SIZE / 2;
		if (avatar) {
			const a = 196;
			ctx.save();
			ctx.beginPath();
			ctx.arc(center, margin + 316, a / 2 + 8, 0, Math.PI * 2);
			ctx.fillStyle = '#fff';
			ctx.fill();
			ctx.beginPath();
			ctx.arc(center, margin + 316, a / 2, 0, Math.PI * 2);
			ctx.clip();
			const s = Math.max(a / avatar.width, a / avatar.height);
			ctx.drawImage(avatar, center - avatar.width * s / 2, margin + 316 - avatar.height * s / 2, avatar.width * s, avatar.height * s);
			ctx.restore();
		}
		ctx.textAlign = 'center';
		ctx.font = '800 48px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#111827';
		ctx.fillText(payload.title, center, margin + 472);
		if (payload.role) {
			ctx.font = '600 24px Inter, system-ui, sans-serif';
			ctx.fillStyle = '#475569';
			ctx.fillText(payload.role, center, margin + 512);
		}
		ctx.textAlign = 'left';
		let chipY = margin + 572;
		const chipX = margin + 128;
		const chipMaxW = cardW - 256;
		for (const meta of (payload.metadata ?? []).slice(0, 3)) {
			const text = [meta.label, meta.value].filter(Boolean).join(' : ');
			ctx.font = '700 20px Inter, system-ui, sans-serif';
			const w = Math.min(ctx.measureText(text).width + 42, chipMaxW);
			roundRect(ctx, chipX, chipY, w, 48, 24);
			ctx.fillStyle = '#eefdf4';
			ctx.fill();
			ctx.strokeStyle = 'rgba(34,197,94,0.24)';
			ctx.lineWidth = 1.5;
			roundRect(ctx, chipX, chipY, w, 48, 24);
			ctx.stroke();
			ctx.fillStyle = accent1;
			ctx.fillText(text, chipX + 21, chipY + 31);
			chipY += 62;
		}
		drawStandardFooter(ctx, standardCard, logo, accent1, payload.author || payload.title || 'Readynaz');
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	if (payload.variant === 'directory' || payload.variant === 'thoughts') {
		const items = (payload.itemTitles ?? []).slice(0, 4);
		const isProjectDir = payload.pageLabel === 'project';
		const count = payload.pageCount ?? items.length;
		const label = payload.variant === 'thoughts' ? 'thought' : isProjectDir ? 'project' : payload.pageLabel ?? 'item';

		ctx.font = '700 54px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#0f172a';
		wrapText(ctx, payload.title, titleX, titleY, titleW, 64, 2);
		if (payload.variant !== 'thoughts') {
			ctx.font = '24px Inter, system-ui, sans-serif';
			ctx.fillStyle = '#475569';
			wrapText(ctx, payload.summary || `${count} ${label}${count === 1 ? '' : 's'}`, titleX, titleY + 124, titleW, 34, 2);
		}

		if (payload.variant === 'thoughts') {
			drawThinkingIcon(ctx, SIZE / 2, titleY + 366, 300, accent1, accent2);
		} else {
			if (isProjectDir) {
				drawPortfolioShowcase(ctx, items, titleX, titleY + 218, titleW, 470, accent1, accent2);
			} else {
				drawArticleStack(ctx, items, titleX + 28, titleY + 238, titleW - 56, accent1);
			}
		}

		drawStandardFooter(ctx, standardCard, logo, accent1, `${count} ${label}${count === 1 ? '' : 's'}`, payload.author || 'Readynaz');
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	if (payload.variant === 'gallery-item') {
		const img = (galleryImages.filter(Boolean)[0] as HTMLImageElement | undefined) ?? cover;
		const imageX = margin + pad;
		const imageY = margin + pad;
		const imageW = cardW - pad * 2;
		const imageH = 570;
		if (img) {
			drawImageCoverRounded(ctx, img, imageX, imageY, imageW, imageH, 22);
		}
		ctx.font = '700 46px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#0f172a';
		const lines = wrapText(ctx, payload.title, titleX, imageY + imageH + 66, titleW, 56, 2);
		if (payload.summary) {
			ctx.font = '24px Inter, system-ui, sans-serif';
			ctx.fillStyle = '#475569';
			wrapText(ctx, payload.summary, titleX, imageY + imageH + 66 + lines * 56 + 12, titleW, 34, 2);
		}
		drawStandardFooter(ctx, standardCard, logo, accent1, 'Gallery', [payload.author, payload.date].filter(Boolean).join(' · '));
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	if (payload.variant === 'gallery') {
		ctx.font = '700 54px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#0f172a';
		ctx.fillText(payload.title, titleX, titleY);
		const imgs = galleryImages.filter(Boolean) as HTMLImageElement[];
		const fallbackCover = imgs.length ? imgs : cover ? [cover] : [];
		ctx.font = '24px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#475569';
		const photoCount = payload.pageCount ?? fallbackCover.length;
		ctx.fillText(`${photoCount} photo${photoCount === 1 ? '' : 's'} from the gallery`, titleX, titleY + 58);
		drawGalleryHomeStack(ctx, fallbackCover, titleX + 16, titleY + 132, titleW - 32, 548, accent1);
		drawStandardFooter(ctx, standardCard, logo, accent1, `${photoCount} photo${photoCount === 1 ? '' : 's'}`, payload.author || 'Readynaz');
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	if (cover) {
		const coverH = 300;
		ctx.save();
		roundRect(ctx, margin + pad, margin + pad, cardW - pad * 2, coverH, 14);
		ctx.clip();
		const scale = Math.max((cardW - pad * 2) / cover.width, coverH / cover.height);
		ctx.drawImage(cover, margin + pad + (cardW - pad * 2 - cover.width * scale) / 2, margin + pad + (coverH - cover.height * scale) / 2, cover.width * scale, cover.height * scale);
		ctx.restore();
		titleY = margin + pad + coverH + 68;
	}

	ctx.font = '700 52px Inter, system-ui, sans-serif';
	ctx.fillStyle = '#0f172a';
	const titleLines = wrapText(ctx, payload.title, titleX, titleY, titleW, 64, 3);

	if (payload.summary) {
		ctx.font = '26px Inter, system-ui, sans-serif';
		ctx.fillStyle = '#475569';
		wrapText(ctx, payload.summary, titleX, titleY + titleLines * 64 + 18, titleW, 36, 2);
	}

	if (payload.tags?.length) {
		let tx = titleX;
		const tagY = SIZE - margin - 174;
		ctx.font = '18px Inter, system-ui, sans-serif';
		for (const tag of payload.tags.slice(0, 4)) {
			const text = `#${tag}`;
			const w = ctx.measureText(text).width + 24;
			if (tx + w > margin + cardW - pad) break;
			roundRect(ctx, tx, tagY - 18, w, 30, 8);
			ctx.fillStyle = '#ecfdf5';
			ctx.fill();
			ctx.fillStyle = accent1;
			ctx.fillText(text, tx + 12, tagY + 4);
			tx += w + 8;
		}
	}

	const meta = [payload.author, payload.date].filter(Boolean).join(' · ');
	drawStandardFooter(ctx, standardCard, logo, accent1, payload.variant === 'portfolio-detail' ? 'Portfolio' : 'Readynaz', meta);

	return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
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
