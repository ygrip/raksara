/**
 * Svelte action: toggles `html.is-reading` once the node (an article header)
 * has scrolled above the viewport, so site chrome can recede while reading.
 * Usage: <header use:readingFocus>
 */
const READING_CLASS = 'is-reading';

export function readingFocus(node: HTMLElement) {
  const root = document.documentElement;
  if (!('IntersectionObserver' in window)) return {};

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry) return;
    // Only "reading" when the header left through the top edge, not the bottom.
    const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    root.classList.toggle(READING_CLASS, scrolledPast);
  });
  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
      root.classList.remove(READING_CLASS);
    },
  };
}
