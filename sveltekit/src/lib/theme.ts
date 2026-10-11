import type { SiteConfig } from './types';

export const COLOR_PALETTES: Record<string, { accent: string; hoverDark: string; hoverLight: string; g1: string; g2: string; g3: string; rgb: string }> = {
  purple: { accent: '#6366f1', hoverDark: '#818cf8', hoverLight: '#4f46e5', g1: '#6366f1', g2: '#8b5cf6', g3: '#a855f7', rgb: '99,102,241' },
  blue: { accent: '#3b82f6', hoverDark: '#60a5fa', hoverLight: '#2563eb', g1: '#3b82f6', g2: '#06b6d4', g3: '#0ea5e9', rgb: '59,130,246' },
  red: { accent: '#ef4444', hoverDark: '#f87171', hoverLight: '#dc2626', g1: '#ef4444', g2: '#f43f5e', g3: '#ec4899', rgb: '239,68,68' },
  yellow: { accent: '#eab308', hoverDark: '#facc15', hoverLight: '#ca8a04', g1: '#eab308', g2: '#f59e0b', g3: '#f97316', rgb: '234,179,8' },
  amber: { accent: '#b76e00', hoverDark: '#efc06e', hoverLight: '#9a5c00', g1: '#e5a940', g2: '#b76e00', g3: '#7c4a03', rgb: '183,110,0' },
  green: { accent: '#22c55e', hoverDark: '#4ade80', hoverLight: '#16a34a', g1: '#22c55e', g2: '#10b981', g3: '#14b8a6', rgb: '34,197,94' },
  orange: { accent: '#f97316', hoverDark: '#fb923c', hoverLight: '#ea580c', g1: '#f97316', g2: '#fb923c', g3: '#fbbf24', rgb: '249,115,22' },
};

// CSS custom properties are also serialized into an SSR <style> element.
// Accept color values, not declarations or HTML; malformed config uses defaults.
function cssColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  const safe = /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d.%+\- ,/deg]+\)|var\(--[\w-]+\))$/i;
  return safe.test(color) ? color : fallback;
}

/** Resolve solid accent channels without a browser, so SSR and canvas agree. */
function accentChannels(color: string): number[] | null {
  if (/^#[\da-f]{3}f$/i.test(color)) color = color.slice(0, 4);
  if (/^#[\da-f]{6}ff$/i.test(color)) color = color.slice(0, 7);
  if (/^#[\da-f]{3}$/i.test(color)) color = '#' + [...color.slice(1)].map(c => c + c).join('');
  if (/^#[\da-f]{6}$/i.test(color)) return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const match = /^(rgb|hsl)a?\(([^)]+)\)$/i.exec(color);
  if (!match) return null;
  const parts = match[2].trim().split(/[\s,/]+/);
  // Translucent accents cannot provide a stable canvas/contrast color.
  if (parts.length < 3 || parts.length > 4 || (parts[3] !== undefined && !['1', '100%'].includes(parts[3]))) return null;
  const rgb = match[1].toLowerCase() === 'rgb';
  if (!parts.slice(0, 3).every((value, i) => (rgb ? /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/ : i === 0 ? /^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg)?$/ : /^[+-]?(?:\d+\.?\d*|\.\d+)%$/).test(value))) return null;
  const numbers = parts.slice(0, 3).map(value => Number(value.replace(/%|deg/g, '')));
  if (!numbers.every(Number.isFinite)) return null;
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
  if (rgb) return numbers.map((value, i) => Math.round(clamp(value * (parts[i].endsWith('%') ? 2.55 : 1), 255)));
  if (!parts[1].endsWith('%') || !parts[2].endsWith('%')) return null;
  const hue = ((numbers[0] % 360) + 360) % 360 / 60;
  const saturation = clamp(numbers[1], 100) / 100;
  const lightness = clamp(numbers[2], 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(hue % 2 - 1));
  const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  return sectors[Math.floor(hue)].map(value => Math.round((value + lightness - chroma / 2) * 255));
}

/** One source for SSR, the pre-paint script, and runtime theme changes. */
export function themeTokens(config: Partial<SiteConfig>, theme: string): Record<string, string> {
  const palette = COLOR_PALETTES[(config.color || '').toLowerCase()] ?? COLOR_PALETTES.purple;
  const configuredAccent = cssColor(config.accent, '');
  const customChannels = accentChannels(configuredAccent);
  const explicitAccent = customChannels ? configuredAccent : '';
  let accent = explicitAccent || palette.accent;
  if (/^#[\da-f]{3}$/i.test(accent)) accent = '#' + [...accent.slice(1)].map(c => c + c).join('');
  const custom = !!customChannels;
  const channels = customChannels ?? palette.rgb.split(',').map(Number);
  const rgb = channels.join(',');
  const dark = theme !== 'light';
  const hover = custom
    ? '#' + channels.map(c => Math.round(dark ? c + (255 - c) * .32 : c * .72).toString(16).padStart(2, '0')).join('')
    : dark ? palette.hoverDark : palette.hoverLight;
  const g1 = cssColor(config.gradient_1, custom ? accent : palette.g1);
  const g2 = cssColor(config.gradient_2, custom ? hover : palette.g2);
  const g3 = cssColor(config.gradient_3, custom ? accent : palette.g3);
  return {
    '--accent': accent, '--accent-hover': hover, '--accent-rgb': rgb,
    '--accent-subtle': `rgba(${rgb},${dark ? .12 : .08})`,
    '--accent-border': `rgba(${rgb},${dark ? .3 : .2})`,
    '--accent-glow': `rgba(${rgb},${dark ? .15 : .1})`,
    '--gradient-1': g1, '--gradient-2': g2, '--gradient-3': g3, '--gradient-4': g1,
    '--bg-hover': dark ? 'rgba(255,255,255,0.06)' : `rgba(${rgb},0.06)`,
    '--bg-active': dark ? 'rgba(255,255,255,0.08)' : `rgba(${rgb},0.08)`,
    '--gradient-bg': `radial-gradient(ellipse 80% 60% at 20% 0%, rgba(${rgb},${dark ? .12 : .08}) 0%, transparent 50%),radial-gradient(ellipse 60% 50% at 80% 100%, rgba(${rgb},${dark ? .08 : .06}) 0%, transparent 50%),radial-gradient(ellipse 50% 40% at 50% 50%, rgba(${rgb},${dark ? .05 : .03}) 0%, transparent 50%)`,
  };
}

/** Escape config values when embedding JSON in a script element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function earlyThemeScript(config: Partial<SiteConfig>): string {
  const tokens = { dark: themeTokens(config, 'dark'), light: themeTokens(config, 'light') };
  return `(function(){var theme='dark';try{theme=localStorage.getItem('raksara-theme')==='light'?'light':'dark';}catch(e){/* Storage unavailable; dark default still works. */}var root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;var tokens=${scriptJson(tokens)};Object.keys(tokens[theme]).forEach(function(key){root.style.setProperty(key,tokens[theme][key]);});})();`;
}
