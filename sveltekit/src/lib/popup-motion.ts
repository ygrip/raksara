import type { TransitionConfig } from 'svelte/transition';

export const popupEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const popupDuration = (closing = false) =>
	matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : closing ? 150 : 250;

// Cubic-bezier(0.22, 1, 0.36, 1), expressed as a Svelte easing function.
export function smoothOut(x: number) {
	if (x === 0 || x === 1) return x;
	let low = 0, high = 1;
	for (let i = 0; i < 16; i++) {
		const t = (low + high) / 2;
		const sample = 3 * (1 - t) ** 2 * t * 0.22 + 3 * (1 - t) * t ** 2 * 0.36 + t ** 3;
		if (sample < x) low = t; else high = t;
	}
	return 1 - (1 - (low + high) / 2) ** 3;
}

// Svelte owns removal and reverses interrupted transitions without stale timers.
export function popupMotion(node: HTMLElement, options: { closing?: boolean; scrim?: boolean } = {}): TransitionConfig {
	const opacity = Number(getComputedStyle(node).opacity);
	return {
		duration: popupDuration(options.closing),
		easing: smoothOut,
		css: (t) => `opacity:${t * opacity};${options.scrim ? '' : `transform:scale(${0.96 + 0.04 * t});`}`
	};
}

const dialogs: HTMLElement[] = [];
let previousOverflow = '';
const focusables = (node: HTMLElement) => Array.from(node.querySelectorAll<HTMLElement>(
	'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
)).filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'));

/** Keep scroll/focus ownership until the node's actual destruction, including its outro. */
export function containDialog(node: HTMLElement) {
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	if (!dialogs.length) previousOverflow = document.body.style.overflow;
	dialogs.push(node);
	document.body.style.overflow = 'hidden';
	const focus = () => (node.querySelector<HTMLElement>('input') ?? focusables(node)[0] ?? node).focus({ preventScroll: true });
	const frame = requestAnimationFrame(focus);
	const onFocus = (event: FocusEvent) => {
		if (dialogs.at(-1) === node && !node.contains(event.target as Node)) focus();
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== 'Tab' || dialogs.at(-1) !== node) return;
		const elements = focusables(node);
		const first = elements[0], last = elements.at(-1);
		if (!first || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
			event.preventDefault();
			(event.shiftKey ? last : first)?.focus();
		}
	};
	document.addEventListener('focusin', onFocus);
	document.addEventListener('keydown', onKey);
	let released = false;
	return { destroy() {
		if (released) return;
		released = true;
		cancelAnimationFrame(frame);
		document.removeEventListener('focusin', onFocus);
		document.removeEventListener('keydown', onKey);
		const wasTop = dialogs.at(-1) === node;
		dialogs.splice(dialogs.indexOf(node), 1);
		if (!dialogs.length) document.body.style.overflow = previousOverflow;
		if (wasTop && opener?.isConnected) opener.focus({ preventScroll: true });
	} };
}

/** The sidebar remains mounted on desktop; retain its modal ownership during mobile exit. */
export function sidebarDialog(node: HTMLElement, open: boolean) {
	let dialog: ReturnType<typeof containDialog> | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const mobile = matchMedia('(max-width: 1023px)');
	function update(value: boolean) {
		open = value;
		clearTimeout(timer);
		if (open && mobile.matches) dialog ??= containDialog(node);
		else timer = setTimeout(() => { dialog?.destroy(); dialog = undefined; }, popupDuration(true));
	}
	const resize = () => update(open);
	mobile.addEventListener('change', resize);
	update(open);
	return { update, destroy() { clearTimeout(timer); mobile.removeEventListener('change', resize); dialog?.destroy(); } };
}
