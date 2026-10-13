/**
 * Practical fallback for Raksara's CSS scroll timelines.
 * Mobile uses this path even when a browser reports timeline support: the
 * effects must remain observable and predictable across mobile engines.
 * No timers or permanent animation loops; one passive, rAF-throttled listener.
 */
function needsFallback(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  const timelines = typeof CSS !== 'undefined'
    && CSS.supports('animation-timeline: view()')
    && CSS.supports('animation-timeline: scroll(root block)');
  return mobile || !timelines;
}

export function attachScrollDepth(hero: HTMLElement, range: number): () => void {
  if (!needsFallback()) return () => {};

  hero.classList.add('rk-js-depth');
  let heroTop = 0;
  let last = -1;
  let frame = 0;

  const update = () => {
    frame = 0;
    const progress = Math.min(1, Math.max(0, (window.scrollY - heroTop) / range));
    if (Math.abs(progress - last) < 0.002) return;
    last = progress;
    // Precalculate CSS lengths instead of multiplying mixed units in calc().
    // Older mobile engines support custom properties but not CSS Values 4 math.
    hero.style.setProperty('--rk-home-halo-y', `${-8 + progress * 44}px`);
    hero.style.setProperty('--rk-home-halo-opacity', String(0.84 - progress * 0.42));
    hero.style.setProperty('--rk-dot-opacity', String(1 - progress * 0.52));
    hero.style.setProperty('--rk-profile-cover-y', `${-12 + progress * 46}px`);
    hero.style.setProperty('--rk-profile-card-y', `${-16 * progress}px`);
    hero.style.setProperty('--rk-mobile-profile-cover-y', `${-8 + progress * 34}px`);
    hero.style.setProperty('--rk-mobile-profile-card-y', `${-11 * progress}px`);
  };
  const queue = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  const measure = () => {
    heroTop = window.scrollY + hero.getBoundingClientRect().top;
    queue();
  };

  const observer = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(measure);
  observer?.observe(hero);
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  measure();

  return () => {
    observer?.disconnect();
    window.removeEventListener('scroll', queue);
    window.removeEventListener('resize', measure);
    if (frame) window.cancelAnimationFrame(frame);
    for (const prop of [
      '--rk-home-halo-y', '--rk-home-halo-opacity', '--rk-dot-opacity',
      '--rk-profile-cover-y', '--rk-profile-card-y',
      '--rk-mobile-profile-cover-y', '--rk-mobile-profile-card-y'
    ]) hero.style.removeProperty(prop);
    hero.classList.remove('rk-js-depth');
  };
}

/** One-shot entrances, with a static accessible fallback without IO. */
export function attachScrollReveals(
  root: HTMLElement,
  selector: string
): () => void {
  if (!needsFallback() || !('IntersectionObserver' in window)) return () => {};

  const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('rk-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -12px 0px' });

  nodes.forEach((node, index) => {
    node.style.setProperty('--rk-reveal-delay', `${(index % 3) * 50}ms`);
    node.classList.add('rk-reveal');
    observer.observe(node);
  });

  return () => {
    observer.disconnect();
    for (const node of nodes) {
      node.classList.remove('rk-reveal', 'rk-revealed');
      node.style.removeProperty('--rk-reveal-delay');
    }
  };
}
