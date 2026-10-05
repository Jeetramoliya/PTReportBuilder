const THEMES = {
  navy: { key: 'navy', name: 'Navy Blue', brand: '#0f4c81', brandDark: '#0a3560', brandLight: '#eef3f8', accent: '#2563eb' },
  crimson: { key: 'crimson', name: 'Crimson Red', brand: '#9f1239', brandDark: '#6d0f28', brandLight: '#fdecef', accent: '#e11d48' },
  emerald: { key: 'emerald', name: 'Emerald Green', brand: '#065f46', brandDark: '#043d2d', brandLight: '#e7f5f0', accent: '#10b981' },
  violet: { key: 'violet', name: 'Violet Purple', brand: '#5b21b6', brandDark: '#3f1682', brandLight: '#f1ecfc', accent: '#8b5cf6' },
  slate: { key: 'slate', name: 'Slate Gray', brand: '#334155', brandDark: '#1e293b', brandLight: '#eef1f4', accent: '#64748b' },
  amber: { key: 'amber', name: 'Amber Orange', brand: '#b45309', brandDark: '#7c3a06', brandLight: '#fdf1e2', accent: '#f59e0b' },
  teal: { key: 'teal', name: 'Teal Cyan', brand: '#0e7490', brandDark: '#0a5568', brandLight: '#e7f6f9', accent: '#06b6d4' },
  charcoal: { key: 'charcoal', name: 'Charcoal Black', brand: '#18181b', brandDark: '#000000', brandLight: '#f0f0f1', accent: '#71717a' },
  rose: { key: 'rose', name: 'Rose Pink', brand: '#be185d', brandDark: '#831843', brandLight: '#fce7f3', accent: '#ec4899' },
  indigo: { key: 'indigo', name: 'Indigo', brand: '#4338ca', brandDark: '#312e81', brandLight: '#e8e7fc', accent: '#6366f1' },
  forest: { key: 'forest', name: 'Forest Green', brand: '#365314', brandDark: '#1a2e05', brandLight: '#eef4e1', accent: '#65a30d' },
  bronze: { key: 'bronze', name: 'Bronze Brown', brand: '#78350f', brandDark: '#451a03', brandLight: '#f4ece1', accent: '#b45309' },
  black: { key: 'black', name: 'Pure Black', brand: '#000000', brandDark: '#000000', brandLight: '#ededed', accent: '#000000' },
};

const COVER_STYLES = [
  { key: 'classic', name: 'Classic', description: 'Clean white cover with a thin brand-colored rule.' },
  { key: 'gradient', name: 'Gradient', description: 'Full-bleed diagonal gradient in the brand color.' },
  { key: 'band', name: 'Hero Band', description: 'Bold color band across the top with the title overlaid.' },
  { key: 'geometric', name: 'Geometric', description: 'Circle and rotated-square accents on a white background.' },
  { key: 'dark', name: 'Dark Mode', description: 'Full dark background with light text — modern and dramatic.' },
  { key: 'split', name: 'Split', description: 'Diagonal two-tone split between brand color and white.' },
  { key: 'frame', name: 'Frame', description: 'White cover with a bold brand-colored border frame.' },
  { key: 'stripe', name: 'Side Stripe', description: 'A solid brand-colored stripe down the left edge.' },
  { key: 'hex', name: 'Hexagon Grid', description: 'A honeycomb pattern of hexagon outlines in the corner.' },
  { key: 'dots', name: 'Dot Grid', description: 'A subtle grid of dots accenting the lower half.' },
  { key: 'blueprint', name: 'Blueprint', description: 'Fine technical grid lines, like an engineering blueprint.' },
];

const PAGE_BACKGROUNDS = [
  { key: 'white', name: 'White', swatch: '#ffffff' },
  { key: 'ivory', name: 'Ivory', swatch: '#faf7f0' },
  { key: 'cool-gray', name: 'Cool Gray', swatch: '#f4f6f8' },
  { key: 'brand-tint', name: 'Brand Tint', swatch: 'theme' },
];

const HEADER_FOOTER_STYLES = [
  { key: 'minimal', name: 'Minimal', description: 'Plain white bar with muted gray text (default).' },
  { key: 'brand-bar', name: 'Brand Bar', description: 'Solid brand-colored bar with white text.' },
  { key: 'dark-bar', name: 'Dark Bar', description: 'Dark bar with light text.' },
  { key: 'line-accent', name: 'Line Accent', description: 'White bar with a colored top/bottom rule.' },
];

const COVER_ALIGNMENTS = [
  { key: 'left', name: 'Left' },
  { key: 'center', name: 'Center' },
  { key: 'right', name: 'Right' },
];

const WORDMARK_STYLES = [
  { key: 'underline', name: 'Underline', description: 'Bold name with a brand-colored rule beneath.' },
  { key: 'plain', name: 'Plain Bold', description: 'Simple bold text, no decoration.' },
  { key: 'boxed', name: 'Outlined', description: 'Name inside a thin brand-colored box.' },
  { key: 'badge', name: 'Solid Badge', description: 'White name on a filled brand-colored badge.' },
  { key: 'spaced', name: 'Spaced Caps', description: 'Wide-tracked uppercase lettering, no rule.' },
];

function clamp(n) {
  return Math.max(0, Math.min(255, n));
}

function hexToRgb(hex) {
  const m = String(hex || '').replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('')}`;
}

function shade(hex, percent) {
  // percent < 0 darkens toward black, > 0 lightens toward white
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  return rgbToHex({ r: r + (t - r) * p, g: g + (t - g) * p, b: b + (t - b) * p });
}

function buildCustomTheme(brandColor) {
  return {
    key: 'custom',
    name: 'Custom (from logo)',
    brand: brandColor,
    brandDark: shade(brandColor, -0.35),
    brandLight: shade(brandColor, 0.88),
    accent: brandColor,
  };
}

function getTheme(key) {
  return THEMES[key] || THEMES.navy;
}

function resolveTheme(project) {
  if (project.theme === 'custom' && project.custom_brand_color) {
    return buildCustomTheme(project.custom_brand_color);
  }
  return getTheme(project.theme);
}

function resolvePageBackground(key, theme) {
  if (key === 'brand-tint') return theme.brandLight;
  const found = PAGE_BACKGROUNDS.find((b) => b.key === key);
  return found ? found.swatch : '#ffffff';
}

module.exports = {
  THEMES, COVER_STYLES, PAGE_BACKGROUNDS, HEADER_FOOTER_STYLES, COVER_ALIGNMENTS, WORDMARK_STYLES,
  getTheme, resolveTheme, buildCustomTheme, resolvePageBackground,
};
