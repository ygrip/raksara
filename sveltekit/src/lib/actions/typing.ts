/**
 * Svelte action: hero typing animation.
 * Usage: <span use:heroTyping={title}>
 * Mirrors legacy 07-home.js initHeroTyping().
 */
export function heroTyping(node: HTMLElement, title: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function run(t: string) {
    if (timer) { clearTimeout(timer); timer = null; }

    // Respect reduced-motion preference and narrow viewports
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.innerWidth < 768
    ) {
      node.textContent = t;
      node.classList.add('typed');
      node.parentElement?.querySelectorAll('.hero-cursor').forEach((el) => el.remove());
      return;
    }

    node.textContent = '';
    node.classList.remove('typed');

    // Remove any leftover cursor
    node.parentElement?.querySelectorAll('.hero-cursor').forEach((el) => el.remove());
    const cursor = document.createElement('span');
    cursor.className = 'hero-cursor';
    cursor.textContent = '|';
    node.after(cursor);

    const chars = t.split('');
    const total = chars.length;
    const slowCount = 3;
    const baseDelay = 70;
    let i = 0;

    function typeNext() {
      if (i >= total) {
        cursor.classList.add('hero-cursor-done');
        timer = setTimeout(() => {
          cursor.remove();
          node.classList.add('typed');
          timer = null;
        }, 600);
        return;
      }
      node.textContent += chars[i];
      const remaining = total - i - 1;
      const delay =
        remaining < slowCount
          ? baseDelay * Math.pow(2.5, slowCount - remaining)
          : baseDelay;
      i++;
      timer = setTimeout(typeNext, delay);
    }

    timer = setTimeout(typeNext, 400);
  }

  run(title);

  return {
    update(newTitle: string) {
      run(newTitle);
    },
    destroy() {
      if (timer) clearTimeout(timer);
      node.parentElement?.querySelectorAll('.hero-cursor').forEach((el) => el.remove());
    },
  };
}
