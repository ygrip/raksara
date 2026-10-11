<script lang="ts">
  /**
   * Decorative SVG mask, intentionally independent from the accent picker.
   * The color is resolved by CSS from --accent and --text-secondary.
   * Does not animate or create a canvas: DotField owns hero motion.
   */
  type Motif = 'kawung' | 'ukiran' | 'mega-mendung';
  type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  type Size = 'small' | 'medium' | 'large';

  interface Props {
    motif?: Motif;
    corner?: Corner;
    size?: Size;
  }

  let { motif = 'ukiran', corner = 'top-right', size = 'medium' }: Props = $props();
</script>

<span
  class={'heritage-ornament heritage-ornament--' + motif + ' heritage-ornament--' + corner + ' heritage-ornament--' + size}
  aria-hidden="true"
></span>
