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
  {#if author}
    <p class="content-footer-copy">&copy; {year} {author}. All rights reserved.</p>
  {/if}

  {#if links.length > 0}
    <nav class="content-footer-links" aria-label="Site information">
      {#each links as link}
        <a href={link.href}>{link.label}</a>
      {/each}
    </nav>
  {/if}
</footer>

<style>
  .content-footer {
    width: 100%;
    max-width: 800px;
    margin: auto auto 0;
    padding: 1.5rem 2rem 2rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.25rem;
    color: var(--text-tertiary);
    font-size: 0.8rem;
  }

  .content-footer-copy {
    margin: 0;
  }

  .content-footer-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }

  .content-footer-links a {
    color: var(--text-secondary);
    text-decoration: none;
    text-underline-offset: 0.2em;
  }

  .content-footer-links a:hover,
  .content-footer-links a:focus-visible {
    color: var(--accent);
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .content-footer {
      align-items: flex-start;
      flex-direction: column;
      padding: 1.25rem 1rem 1.5rem;
    }
  }
</style>
