<script lang="ts">
  interface FooterLink {
    label: string;
    href: string;
  }

  interface Props {
    author?: string;
    year?: number;
    links?: FooterLink[];
  }

  const defaultLinks: FooterLink[] = [
    { label: 'About', href: '/about/' },
    { label: 'Privacy', href: '/privacy/' },
    { label: 'Contact', href: '/contact/' },
  ];

  let {
    author,
    year = new Date().getFullYear(),
    links = defaultLinks,
  }: Props = $props();
</script>

<footer class="content-footer">
  <span class="content-footer-grid" aria-hidden="true"></span>
  <span class="content-footer-glow" aria-hidden="true"></span>

  {#if author}
    <div class="content-footer-identity">
      <span class="content-footer-mark" aria-hidden="true"><span></span></span>
      <div class="content-footer-copy-wrap">
        <strong>{author}</strong>
        <p class="content-footer-copy">&copy; {year}. All rights reserved.</p>
      </div>
    </div>
  {/if}

  {#if links.length > 0}
    <nav class="content-footer-links" aria-label="Site information">
      {#each links as link}
        <a href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>
      {/each}
    </nav>
  {/if}
</footer>

<style>
  .content-footer {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: min(100%, 72rem);
    margin: 4rem auto 0;
    padding: clamp(1.25rem, 2.4vw, 1.7rem);
    border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
    border-radius: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem 1.5rem;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--bg-glass-heavy) 92%, white 3%),
        color-mix(in srgb, var(--bg-card) 92%, transparent)
      );
    -webkit-backdrop-filter: blur(18px) saturate(1.12);
    backdrop-filter: blur(18px) saturate(1.12);
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--shadow-color) 58%, transparent),
      0 22px 54px -30px color-mix(in srgb, var(--shadow-heavy) 88%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 45%, transparent);
    color: var(--text-tertiary);
    font-size: 0.8rem;
  }

  .content-footer-grid {
    position: absolute;
    inset: 0;
    z-index: -2;
    background-image:
      linear-gradient(color-mix(in srgb, var(--accent) 7%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--accent) 7%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    opacity: 0.6;
    -webkit-mask-image: radial-gradient(ellipse 72% 100% at 100% 0%, #000 0%, transparent 76%);
    mask-image: radial-gradient(ellipse 72% 100% at 100% 0%, #000 0%, transparent 76%);
    pointer-events: none;
  }

  .content-footer-glow {
    position: absolute;
    z-index: -1;
    top: -70%;
    right: -12%;
    width: 46%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    filter: blur(46px);
    pointer-events: none;
  }

  .content-footer-identity {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .content-footer-mark {
    position: relative;
    width: 2.65rem;
    height: 2.65rem;
    flex: 0 0 2.65rem;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border-color));
    border-radius: 0.9rem;
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%),
      var(--bg-glass-heavy);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 42%, transparent),
      0 8px 22px color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .content-footer-mark::before,
  .content-footer-mark::after,
  .content-footer-mark > span {
    content: "";
    position: absolute;
    border-radius: 999px;
    background: var(--accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .content-footer-mark::before {
    width: 1.1rem;
    height: 0.2rem;
    transform: rotate(45deg);
  }

  .content-footer-mark::after {
    width: 1.1rem;
    height: 0.2rem;
    transform: rotate(-45deg);
  }

  .content-footer-mark > span {
    width: 0.34rem;
    height: 0.34rem;
  }

  .content-footer-copy-wrap {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }

  .content-footer-copy-wrap strong {
    color: var(--text-primary);
    font-size: 0.92rem;
    letter-spacing: -0.015em;
  }

  .content-footer-copy {
    margin: 0;
  }

  .content-footer-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
  }

  .content-footer-links a {
    min-height: 2.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--border-color) 82%, transparent);
    border-radius: 0.85rem;
    background: color-mix(in srgb, var(--bg-glass-heavy) 88%, transparent);
    color: var(--text-secondary);
    font-weight: 650;
    text-decoration: none;
    transition:
      transform 160ms ease,
      color 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .content-footer-links a span {
    color: var(--accent);
    opacity: 0.8;
  }

  .content-footer-links a:hover,
  .content-footer-links a:focus-visible {
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--accent) 46%, var(--border-color));
    background: color-mix(in srgb, var(--accent) 7%, var(--bg-glass-heavy));
    box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 10%, transparent);
    transform: translateY(-2px);
  }

  .content-footer-links a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .content-footer {
      align-items: stretch;
      flex-direction: column;
      margin-top: 3rem;
      padding: 1.1rem;
      border-radius: 1.25rem;
    }

    .content-footer-links {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .content-footer-links a {
      justify-content: center;
    }
  }

  @media (max-width: 420px) {
    .content-footer-links {
      grid-template-columns: 1fr;
    }
  }
</style>
