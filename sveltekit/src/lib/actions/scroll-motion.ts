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
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 768px)');
  let detach = () => {};

  const sync = () => {
    detach();
    detach = () => {};
    if (!needsFallback()) return;

    hero.classList.add('rk-js-depth');
    let heroTop = 0;
    let last = -1;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, (window.scrollY - heroTop) / range));
      if (Math.abs(progress - last) < 0.002) return;
      last = progress;
      // Keep fallback travel in sync with the CSS timeline's two depth planes.
      hero.style.setProperty('--rk-home-halo-y', `${-18 + progress * 128}px`);
      hero.style.setProperty('--rk-home-halo-opacity', String(0.95 - progress * 0.6));
      hero.style.setProperty('--rk-dot-opacity', String(1 - progress * 0.55));
      hero.style.setProperty('--rk-profile-cover-y', `${-32 + progress * 152}px`);
      hero.style.setProperty('--rk-profile-card-y', `${-64 * progress}px`);
      hero.style.setProperty('--rk-mobile-profile-cover-y', `${-18 + progress * 90}px`);
      hero.style.setProperty('--rk-mobile-profile-card-y', `${-34 * progress}px`);
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const measure = () => {
      heroTop = window.scrollY + hero.getBoundingClientRect().top;
      // A resized hero can change its depth values without changing progress.
      last = -1;
      queue();
    };
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure);
    observer?.observe(hero);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    measure();

    detach = () => {
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
  };
  reduced.addEventListener('change', sync);
  mobile.addEventListener('change', sync);
  sync();

  return () => {
    detach();
    reduced.removeEventListener('change', sync);
    mobile.removeEventListener('change', sync);
  };
}

/** Pointer depth reads the stationary hero, never the surface it rotates. */
export function attachHeroTilt(hero: HTMLElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0;
  let x = 0.5;
  let y = 0.5;
  const props = ['--rk-tilt-x', '--rk-tilt-y'];
  let lastX = '';
  let lastY = '';

  const reset = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    hero.classList.remove('rk-pointer-active');
    for (const prop of props) hero.style.removeProperty(prop);
    lastX = '';
    lastY = '';
  };
  const sync = () => {
    reset();
    hero.classList.toggle('rk-pointer-depth', !reduced.matches && pointer.matches);
  };
  const move = (event: PointerEvent) => {
    if (reduced.matches || !pointer.matches || document.visibilityState === 'hidden' || event.pointerType !== 'mouse') return;
    x = event.clientX;
    y = event.clientY;
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      x = Math.min(1, Math.max(0, (x - bounds.left) / bounds.width));
      y = Math.min(1, Math.max(0, (y - bounds.top) / bounds.height));
      const rx = `${Math.round((0.5 - y) * 180) / 10}deg`;
      const ry = `${Math.round((x - 0.5) * 180) / 10}deg`;
      if (rx === lastX && ry === lastY) return;
      hero.classList.add('rk-pointer-active');
      if (rx !== lastX) hero.style.setProperty('--rk-tilt-x', rx);
      if (ry !== lastY) hero.style.setProperty('--rk-tilt-y', ry);
      lastX = rx;
      lastY = ry;
    });
  };

  hero.addEventListener('pointermove', move);
  hero.addEventListener('pointerleave', reset);
  hero.addEventListener('pointercancel', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  reduced.addEventListener('change', sync);
  pointer.addEventListener('change', sync);
  sync();

  return () => {
    reset();
    hero.classList.remove('rk-pointer-depth');
    hero.removeEventListener('pointermove', move);
    hero.removeEventListener('pointerleave', reset);
    hero.removeEventListener('pointercancel', reset);
    window.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', reset);
    reduced.removeEventListener('change', sync);
    pointer.removeEventListener('change', sync);
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
    node.style.setProperty('--rk-reveal-delay', `${(index % 3) * 40}ms`);
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
