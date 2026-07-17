(() => {
	const destinationLabels = new Map([
		['/blog', 'All blog posts'],
		['/portfolio', 'All portfolio projects'],
		['/thoughts', 'All thoughts'],
		['/gallery', 'All gallery items'],
	]);

	function normalizePath(href) {
		try {
			const pathname = new URL(href, document.baseURI).pathname;
			if (pathname === '/') return '/';
			return `/${pathname.replace(/^\/+|\/+$/g, '')}`;
		} catch {
			return '';
		}
	}

	function enhanceSectionLinks(root = document) {
		root.querySelectorAll('.home-section-header a[href]').forEach((link) => {
			if (!(link instanceof HTMLAnchorElement)) return;
			if (!/^view all\b/i.test(link.textContent?.trim() ?? '')) return;

			const path = normalizePath(link.href);
			const heading = link.closest('.home-section')?.querySelector('h2')?.textContent?.trim();
			const label = destinationLabels.get(path) || (heading ? `All ${heading}` : 'View all items');

			link.textContent = `${label} →`;
			link.setAttribute('aria-label', label);
			link.dataset.accessibilityEnhanced = 'true';
		});
	}

	function start() {
		enhanceSectionLinks();

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node instanceof Element) enhanceSectionLinks(node);
				}
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	} else {
		start();
	}
})();
