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

function createThinkingIconImage(color: string): Promise<HTMLImageElement> {
	const safeColor = color || '#22c55e';
	const svg = `<?xml version="1.0" encoding="iso-8859-1"?>
<svg fill="${safeColor}" stroke="${safeColor}" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 296.429 296.429" xml:space="preserve">
<g>
	<g>
		<g>
			<path d="M277.381,48.81V15.476l11.429,8.571l5.714-7.619L272.619,0l-21.905,16.429l5.714,7.619l11.429-8.571V48.81
				c0,13.129-10.681,23.81-23.81,23.81H225c-15.067,0-27.814,9.524-31.929,23.81h-6.819l-0.176,9.524h5.59v14.843
				c-2.338-0.333-4.71-0.557-7.143-0.557c-11.076,0-21.724,3.7-30.467,10.51c-6.252-6.652-15.01-10.51-24.295-10.51
				c-3.262,0-6.462,0.519-9.524,1.438v-30.01c0-15.757-12.814-28.571-28.571-28.571h-4.762v-9.524H77.38v9.524H63.095
				c-15.757,0-28.571,12.814-28.571,28.571v9.524c0,5.252-4.271,9.524-9.524,9.524h-9.524l8.571-11.429l-7.619-5.714L0,115.476
				l16.429,21.905l7.619-5.714l-8.571-11.429H25c10.505,0,19.048-8.543,19.048-19.048v-9.524c0-10.505,8.543-19.048,19.048-19.048
				h28.571c10.505,0,19.048,8.543,19.048,19.048v34.619c-2.071,1.448-4,3.11-5.714,5.014c-3.586-1.024-7.262-1.538-10.952-1.538
				c-20.429,0-37.386,15.105-40.062,34.995C36.995,169.781,25,185.567,25,203.571c0,8.429,2.652,16.662,7.519,23.49
				c-1.833,4.681-2.757,9.581-2.757,14.605c0,22.319,18.157,40.476,40.476,40.476c1.805,0,3.571-0.162,5.314-0.39
				c0.329-0.043,0.657-0.1,0.986-0.152c1.762-0.276,3.495-0.643,5.181-1.143c6.548,4.229,14.048,6.448,21.852,6.448
				c8.729,0,17.043-2.748,23.943-7.838c7.505,10.838,19.757,17.362,33.2,17.362c12.486,0,23.986-5.629,31.633-15.271
				c6.262,3.776,13.343,5.748,20.748,5.748c22.319,0,40.476-18.157,40.476-40.476c0-4.819-0.852-9.524-2.533-14.029
				c7.7-7.59,12.057-17.91,12.057-28.829c0-2.429-0.238-4.814-0.657-7.143h0.657v-9.524h-3.638
				c-4.771-10.486-13.886-18.729-25.276-22.119c-2.095-19.519-15.233-35.438-32.99-41.676v-17.157
				c0-13.129,10.681-23.81,23.81-23.81h19.048C262.424,82.143,277.381,67.186,277.381,48.81z M224.919,168.748l0.133,3.757
				l3.686,0.738c8.567,1.719,15.667,6.981,20.067,14.024v9.162h3.814c0.562,2.314,0.952,4.686,0.952,7.143
				c0,7.562-2.767,14.714-7.662,20.314c-6.848-9.429-17.69-15.195-30.124-16.019l-0.624,8.91
				c15.819,1.043,28.257,12.452,28.829,30.729c-0.571,16.567-14.19,29.876-30.895,29.876c-6.933,0-13.51-2.271-19.014-6.567
				l-1.9-1.486c-5.867-5.343-9.467-12.752-10.005-20.838l-9.505,0.633c0.671,10.081,5.033,19.343,12.105,26.243
				c-5.848,7.29-14.586,11.538-24.062,11.538c-11.824,0-22.448-6.61-27.714-17.252l-2.933-5.919l-4.69,4.662
				c-5.838,5.79-13.581,8.986-21.805,8.986c-3.767,0-7.414-0.752-10.876-2.067c10.857-7.267,18.019-19.633,18.019-33.648
				c0-1.014-0.133-2-0.205-3c7.576-1.314,14.657-4.743,20.405-10.014l-6.438-7.024c-4.438,4.067-9.905,6.695-15.762,7.676
				c-3.186-9.943-10.081-18.443-19.643-23.481l-4.438,8.429c10.214,5.386,16.557,15.886,16.557,27.414
				c0,13.362-8.529,24.738-20.414,29.067c-1.676,0.605-3.376,1.062-5.086,1.376c-0.114,0.019-0.229,0.033-0.343,0.052
				c-1.7,0.29-3.405,0.457-5.11,0.457c-17.067,0-30.952-13.886-30.952-30.952c0-4.581,1.014-9.033,3.014-13.248l1.305-2.743
				l-1.943-2.343c-4.605-5.543-7.138-12.557-7.138-19.762c0-14.695,10.443-27.457,24.829-30.343l3.652-0.729l0.171-3.714
				c0.486-10.41,6.038-19.39,14.205-24.624v9.41h9.524v-13.424c2.295-0.543,4.681-0.862,7.143-0.862
				c3.681,0,7.352,0.681,10.895,2.019l3.405,1.286l2.133-2.943c0.071-0.1,0.157-0.186,0.233-0.286v23.733h9.524v-31.276
				c2.976-1.314,6.205-2.057,9.524-2.057c6.59,0,12.786,2.748,17.243,7.452c-7.981,9.081-13.671,20.838-13.671,33.024
				c0,27.571,25,50,48.81,50v-9.524c-19.048,0-39.286-18.157-39.286-40.476c0-9.938,4.286-19.529,10.838-26.905l2.729-2.319
				c7.6-7.257,17.624-11.252,27.952-11.252c2.443,0,4.971,0.243,7.29,0.657v18.39c0,13.129-10.681,23.81-23.81,23.81h-4.762v9.524
				h4.762c18.376,0,33.333-14.957,33.333-33.333v-15.448C214.767,139.481,224.338,152.843,224.919,168.748z"/>
			<rect x="220.238" y="186.905" width="14.286" height="9.524"/>
			<rect x="244.048" y="96.429" width="14.286" height="9.524"/>
			<path d="M170.176,101.424l4.8-8.224c-3.438-2.01-6.352-4.867-8.429-8.271l-8.129,4.957
				C161.314,94.633,165.376,98.624,170.176,101.424z"/>
			<path d="M153.57,72.619L153.57,72.619c0.001,0.495,0.011,0.99,0.034,1.486l9.514-1.057l-0.024-14.714h-9.524V72.619z"/>
			<rect x="153.571" y="29.762" width="9.524" height="14.286"/>
			<path d="M274.49,183.981l4.586,8.343c4.867-2.676,9.033-6.562,12.052-11.233l-8.01-5.162
				C280.962,179.271,277.976,182.057,274.49,183.981z"/>
			<path d="M286.905,163.095c0,0.562-0.019,1.119-0.062,1.681l9.505,0.662c0.052-0.776,0.081-1.557,0.081-2.343V148.81h-9.524
				V163.095z"/>
			<rect x="215.476" y="96.429" width="14.286" height="9.524"/>
			<path d="M295.276,121.095l-9.19,2.481c0.543,2.014,0.819,4.095,0.819,6.186v4.762h9.524v-4.762
				C296.429,126.833,296.043,123.914,295.276,121.095z"/>
			<path d="M287.162,106.743c-3.857-4.033-8.686-7.057-13.971-8.748l-2.9,9.067c3.771,1.21,7.229,3.376,9.99,6.262L287.162,106.743z"/>
			<polygon points="153.571,15.476 163.095,15.476 174.524,24.048 180.238,16.429 158.333,0 136.429,16.429 142.143,24.048"/>
			<rect x="77.381" y="25" width="9.524" height="14.286"/>
			<rect x="77.381" y="110.714" width="9.524" height="14.286"/>
			<rect x="77.381" y="82.143" width="9.524" height="14.286"/>
			<rect x="77.381" y="167.857" width="9.524" height="14.286"/>
			<polygon points="82.143,11.905 98.333,24.048 104.048,16.429 82.143,0 60.238,16.429 65.952,24.048"/>
		</g>
	</g>
</g>
</svg>`;
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('thinking icon failed'));
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

function drawThinkingIcon(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	icon: HTMLImageElement | null,
	accent1: string,
	accent2: string
) {
	const cardW = size * 1.22;
	const cardH = size * 0.94;
	const cardX = x - cardW / 2;
	const cardY = y - cardH / 2;
	const radius = 44;

	ctx.save();
	ctx.shadowColor = 'rgba(15,23,42,0.20)';
	ctx.shadowBlur = 44;
	ctx.shadowOffsetY = 18;
	roundRect(ctx, cardX, cardY, cardW, cardH, radius);
	ctx.fillStyle = 'rgba(255,255,255,0.56)';
	ctx.fill();
	ctx.restore();

	const glassGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
	glassGrad.addColorStop(0, 'rgba(255,255,255,0.62)');
	glassGrad.addColorStop(0.52, 'rgba(255,255,255,0.42)');
	glassGrad.addColorStop(1, 'rgba(255,255,255,0.30)');
	roundRect(ctx, cardX, cardY, cardW, cardH, radius);
	ctx.fillStyle = glassGrad;
	ctx.fill();

	ctx.strokeStyle = 'rgba(255,255,255,0.72)';
	ctx.lineWidth = 1.8;
	roundRect(ctx, cardX + 0.9, cardY + 0.9, cardW - 1.8, cardH - 1.8, radius - 1.2);
	ctx.stroke();

	if (icon) {
		const iconSize = Math.min(cardW, cardH) * 0.84;
		ctx.save();
		ctx.globalAlpha = 0.96;
		ctx.drawImage(icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
		ctx.restore();
		return;
	}

	ctx.font = '900 84px Inter, system-ui, sans-serif';
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.fillText('?', x, y + 30);
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
		createThinkingIconImage(accent1),
		payload.coverUrl ? loadImage(payload.coverUrl) : Promise.reject(),
		payload.avatarUrl ? loadImage(payload.avatarUrl) : Promise.reject(),
		Promise.all((payload.galleryImageUrls ?? []).slice(0, 4).map((url) => loadImage(url).catch(() => null))),
	]);
	const logo = results[0].status === 'fulfilled' ? results[0].value as HTMLImageElement : null;
	const thinkingIcon = results[1].status === 'fulfilled' ? results[1].value as HTMLImageElement : null;
	const cover = results[2].status === 'fulfilled' ? results[2].value as HTMLImageElement : null;
	const avatar = results[3].status === 'fulfilled' ? results[3].value as HTMLImageElement : null;
	const galleryImages = results[4].status === 'fulfilled' ? results[4].value as Array<HTMLImageElement | null> : [];

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
			drawThinkingIcon(ctx, SIZE / 2, titleY + 366, 300, thinkingIcon, accent1, accent2);
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
