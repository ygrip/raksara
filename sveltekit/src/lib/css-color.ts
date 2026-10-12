export type Rgb = [number, number, number];

/** OKLab → sRGB bytes (Björn Ottosson's reference matrices), clamped to gamut. */
function oklabToRgb(l: number, a: number, b: number): Rgb {
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
	];
	return linear.map((c) => {
		const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(255, Math.max(0, v * 255)));
	}) as Rgb;
}

/**
 * Parse a computed CSS colour into sRGB bytes without a canvas readback.
 * Handles hex, rgb(), `color(srgb …)` (what `color-mix(in srgb, X 100%,
 * transparent)` computes to) and oklab()/oklch(), which Chrome reports while
 * a colour transition is interpolating.
 */
export function parseCssColor(value: string, fallback: Rgb): Rgb {
	const text = value.trim();
	const hex = /^#([\da-f]{6})$/i.exec(text);
	if (hex) return [0, 2, 4].map((at) => Number.parseInt(hex[1].slice(at, at + 2), 16)) as Rgb;
	const numbers = text.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
	if (numbers.length < 3) return fallback;
	const [p, q, r] = numbers;
	if (text.startsWith('oklab(')) return oklabToRgb(p, q, r);
	if (text.startsWith('oklch(')) return oklabToRgb(p, q * Math.cos((r * Math.PI) / 180), q * Math.sin((r * Math.PI) / 180));
	if (!text.startsWith('rgb') && !text.startsWith('color(srgb ')) return fallback;
	const unit = text.startsWith('color(srgb ') ? 255 : 1;
	return [p, q, r].map((n) => Math.round(Math.min(255, Math.max(0, n * unit)))) as Rgb;
}
/** Linear sRGB-byte mix: `t` = 0 returns `a`, 1 returns `b`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
	return a.map((channel, k) => Math.round(channel + (b[k] - channel) * t)) as Rgb;
}

export function rgba([r, g, b]: Rgb, alpha = 1): string {
	return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}
