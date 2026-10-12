/**
 * Firefly renderer that runs entirely in a worker on a transferred
 * OffscreenCanvas. Its frames go straight to the compositor, so drifting
 * fireflies cost the page's main thread nothing. (Moving DOM fireflies with
 * transform animations made Chrome recompute IntersectionObserver geometry on
 * the main thread every frame.)
 */

export interface WorkerFly {
	/** Resting centre in CSS px. */
	x: number;
	y: number;
	size: number;
	/** Drift amplitude (px) and periods (s) of an elliptical wander. */
	dx: number;
	dy: number;
	periodX: number;
	periodY: number;
	/** Glow pulse period (s). */
	pulse: number;
	phase: number;
	peak: number;
	glass: boolean;
}

export interface FireflyPalette {
	core: string;
	mid: string;
	halo: string;
	glassHalo: string;
}

export type FireflyMessage =
	| { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; flies: WorkerFly[]; palette: FireflyPalette; still: boolean }
	| { type: 'resize'; width: number; height: number; flies: WorkerFly[] }
	| { type: 'palette'; palette: FireflyPalette }
	| { type: 'pause' }
	| { type: 'resume' };

/** Slow drift reads as smooth at 30 fps and halves raster work against 60. */
const FRAME_MS = 1000 / 30;

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let flies: WorkerFly[] = [];
let palette: FireflyPalette | null = null;
let sprites: OffscreenCanvas[] = [];
let still = false;
let running = false;
let handle = 0;
let last = 0;
/** Rectangles painted by the previous frame; only these are cleared. */
let painted: Array<[number, number, number, number]> = [];

const hasRaf = typeof requestAnimationFrame === 'function';

function sprite(size: number, glass: boolean): OffscreenCanvas {
	const px = Math.max(2, Math.ceil(size));
	const out = new OffscreenCanvas(px, px);
	const sctx = out.getContext('2d');
	if (!sctx || !palette) return out;
	const r = px / 2;
	const gradient = sctx.createRadialGradient(r, r, 0, r, r, r);
	if (glass) {
		gradient.addColorStop(0, palette.core);
		gradient.addColorStop(0.16, palette.core);
		gradient.addColorStop(0.34, palette.mid);
		gradient.addColorStop(0.58, palette.glassHalo);
	} else {
		gradient.addColorStop(0, palette.core);
		gradient.addColorStop(0.07, palette.core);
		gradient.addColorStop(0.18, palette.mid);
		gradient.addColorStop(0.45, palette.halo);
	}
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	sctx.fillStyle = gradient;
	sctx.fillRect(0, 0, px, px);
	return out;
}

function rebuildSprites() {
	sprites = flies.map((fly) => sprite(fly.size, fly.glass));
	painted = [];
	ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
}

function draw(now: number) {
	if (!ctx || !canvas) return;
	const t = now / 1000;
	for (const [x, y, w, h] of painted) ctx.clearRect(x, y, w, h);
	painted = [];
	for (let i = 0; i < flies.length; i += 1) {
		const fly = flies[i];
		const image = sprites[i];
		if (!image) continue;
		const tau = Math.PI * 2;
		const ox = still ? 0 : fly.dx * Math.sin((tau * t) / fly.periodX + fly.phase);
		const oy = still ? 0 : fly.dy * Math.sin((tau * t) / fly.periodY + fly.phase * 1.7);
		// Fireflies flare and fade rather than glowing steadily.
		const wave = 0.5 + 0.5 * Math.sin((tau * t) / fly.pulse + fly.phase * 2.3);
		const alpha = still ? fly.peak * 0.6 : fly.peak * (0.12 + 0.88 * wave * wave);
		const x = Math.round(fly.x + ox - image.width / 2);
		const y = Math.round(fly.y + oy - image.height / 2);
		ctx.globalAlpha = alpha;
		ctx.drawImage(image, x, y);
		painted.push([x - 1, y - 1, image.width + 2, image.height + 2]);
	}
	ctx.globalAlpha = 1;
}

function loop(now: number) {
	handle = 0;
	if (!running) return;
	if (now - last >= FRAME_MS - 2) {
		last = now;
		draw(now);
	}
	schedule();
}

function schedule() {
	if (!running || handle) return;
	handle = hasRaf
		? requestAnimationFrame(loop)
		: (setTimeout(() => loop(performance.now()), FRAME_MS) as unknown as number);
}

function stop() {
	running = false;
	if (!handle) return;
	if (hasRaf) cancelAnimationFrame(handle);
	else clearTimeout(handle);
	handle = 0;
}

function start() {
	if (still) {
		draw(performance.now());
		return;
	}
	running = true;
	schedule();
}

self.onmessage = (event: MessageEvent<FireflyMessage>) => {
	const message = event.data;
	switch (message.type) {
		case 'init':
			canvas = message.canvas;
			canvas.width = message.width;
			canvas.height = message.height;
			ctx = canvas.getContext('2d');
			flies = message.flies;
			palette = message.palette;
			still = message.still;
			rebuildSprites();
			start();
			break;
		case 'resize':
			if (!canvas) return;
			canvas.width = message.width;
			canvas.height = message.height;
			flies = message.flies;
			rebuildSprites();
			if (still) draw(performance.now());
			break;
		case 'palette':
			palette = message.palette;
			rebuildSprites();
			if (still) draw(performance.now());
			break;
		case 'pause':
			stop();
			break;
		case 'resume':
			start();
			break;
	}
};
