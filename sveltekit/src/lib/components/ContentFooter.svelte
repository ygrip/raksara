<script lang="ts">
  /** © {year} {author} — shown at the bottom of every content page */
  interface Props {
    author?: string;
    year?: number;
  }
  let { author, year = new Date().getFullYear() }: Props = $props();
</script>

{#if author}
<footer class="content-footer mx-auto max-w-3xl">
  &copy; {year} {author}. All rights reserved.
</footer>
{/if}
