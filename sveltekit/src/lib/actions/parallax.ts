/**
 * Svelte action: parallax scroll effect.
 * Usage: <div use:parallax={{ speed: 0.3 }}>
 * Mirrors legacy parallax from 14-ui.js / 07-home.js.
 */
export interface ParallaxOptions {
  /** 0 = no movement, 1 = full scroll speed. Default 0.3 */
  speed?: number;
}

export function parallax(node: HTMLElement, options: ParallaxOptions = {}) {
  const { speed = 0.3 } = options;
  let ticking = false;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};

  function update() {
    node.style.transform = `translateY(${window.scrollY * speed}px)`;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  return {
    update(newOpts: ParallaxOptions) {
      // speed update not needed dynamically, but keep signature consistent
      void newOpts;
    },
    destroy() {
      window.removeEventListener('scroll', onScroll);
    },
  };
}
