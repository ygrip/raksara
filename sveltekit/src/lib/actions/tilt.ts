/**
 * Svelte action: transitions.dev card hover tilt, delegated from a container.
 * Usage: <div class="portfolio-grid" use:tilt={{ selector: '.portfolio-card' }}>
 *
 * The container never transforms, so it is the flat hit area. Hit-testing
 * uses each card's untransformed rect (captured on entry), so rotating edges
 * can't slip out from under the cursor and flicker the hover. Fine-pointer
 * hover devices only: touch keeps native scrolling, reduced motion opts out.
 */
export interface TiltOptions {
  /** Cards inside the container that should tilt. */
  selector: string;
  /** Peak tilt in degrees at the card edges. Default 8. */
  max?: number;
}

interface FlatRect { left: number; top: number; width: number; height: number }

export function tilt(container: HTMLElement, options: TiltOptions) {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let { selector, max = 8 } = options;
  let active: HTMLElement | null = null;
  let rect: FlatRect | null = null;
  let frame = 0;
  let lastX = 0;
  let lastY = 0;

  const glareOf = (card: HTMLElement) => {
    let glare = card.querySelector<HTMLElement>(':scope > .t-tilt-glare');
    if (!glare) {
      glare = document.createElement('span');
      glare.className = 't-tilt-glare';
      glare.setAttribute('aria-hidden', 'true');
      card.appendChild(glare);
    }
    return glare;
  };

  /** Page-space rect of a flat card (it is flat whenever it is not active). */
  const capture = (card: HTMLElement): FlatRect => {
    const r = card.getBoundingClientRect();
    return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
  };

  const release = () => {
    if (!active) return;
    active.classList.remove('is-tilt-active', 'is-tilting');
    active.style.setProperty('--tilt-rx', '0deg');
    active.style.setProperty('--tilt-ry', '0deg');
    active = null;
    rect = null;
  };

  const inside = (r: FlatRect, x: number, y: number) =>
    x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

  const apply = () => {
    frame = 0;
    const pageX = lastX + window.scrollX;
    const pageY = lastY + window.scrollY;

    if (!active || !rect || !inside(rect, pageX, pageY)) {
      release();
      const hit = document.elementFromPoint(lastX, lastY)?.closest<HTMLElement>(selector);
      if (!hit || !container.contains(hit)) return;
      active = hit;
      rect = capture(hit);
      glareOf(hit);
      hit.classList.add('is-tilt-active');
    }
    if (!active || !rect) return;

    const px = Math.min(1, Math.max(0, (pageX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (pageY - rect.top) / rect.height));
    active.classList.add('is-tilting');
    active.style.setProperty('--tilt-ry', `${((px - 0.5) * max).toFixed(2)}deg`);
    active.style.setProperty('--tilt-rx', `${((0.5 - py) * max).toFixed(2)}deg`);
    active.style.setProperty('--tilt-gx', `${(px * 100).toFixed(1)}%`);
    active.style.setProperty('--tilt-gy', `${(py * 100).toFixed(1)}%`);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || reduce.matches || !canHover.matches) return;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!frame) frame = window.requestAnimationFrame(apply);
  };

  const onLeave = () => {
    if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
    release();
  };

  container.dataset['tilt'] = '';
  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerleave', onLeave);
  // Layout under a captured rect may move without the pointer moving.
  window.addEventListener('scroll', onLeave, { passive: true });
  window.addEventListener('resize', onLeave, { passive: true });

  return {
    update(next: TiltOptions) {
      onLeave();
      ({ selector, max = 8 } = next);
    },
    destroy() {
      onLeave();
      delete container.dataset['tilt'];
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onLeave);
      window.removeEventListener('resize', onLeave);
      container.querySelectorAll(`${selector} > .t-tilt-glare`).forEach((g) => g.remove());
      container.querySelectorAll<HTMLElement>(selector).forEach((card) => {
        for (const p of ['--tilt-rx', '--tilt-ry', '--tilt-gx', '--tilt-gy']) card.style.removeProperty(p);
      });
    },
  };
}
