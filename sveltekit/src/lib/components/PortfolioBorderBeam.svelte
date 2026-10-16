<!-- A single accent trace, not an ambient animation. Keep the card's carved
     pseudo-elements, tilt, link hit areas and persistent focus outline intact. -->
<svg class="portfolio-border-beam" aria-hidden="true" focusable="false">
	<rect x="1" y="1" pathLength="100" />
</svg>

<style>
	.portfolio-border-beam {
		position: absolute;
		inset: -1px;
		width: calc(100% + 2px);
		height: calc(100% + 2px);
		z-index: 4;
		pointer-events: none;
		border-radius: inherit;
	}

	rect {
		width: calc(100% - 2px);
		height: calc(100% - 2px);
		rx: calc(var(--hg-radius-card, var(--radius-lg, 16px)) - 1px);
		fill: none;
		stroke: var(--hg-accent-text, var(--accent));
		stroke-width: 1.5px;
		stroke-linecap: round;
		stroke-dasharray: 14 86;
		vector-effect: non-scaling-stroke;
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.portfolio-card:focus-within) rect {
			animation: portfolio-border-trace var(--duration-very-slow, 500ms) linear both;
		}
	}

	@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
		:global(.portfolio-card:hover) rect {
			animation: portfolio-border-trace var(--duration-very-slow, 500ms) linear both;
		}
	}

	@keyframes portfolio-border-trace {
		0% { stroke-dashoffset: 0; opacity: 0; }
		20%, 80% { opacity: 1; }
		100% { stroke-dashoffset: -100; opacity: 0; }
	}

	@media (prefers-reduced-motion: reduce), (forced-colors: active) {
		.portfolio-border-beam { display: none; }
		rect { animation: none; }
	}
</style>
