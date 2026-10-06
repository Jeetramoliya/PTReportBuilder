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
  { key: 'corner', name: 'Corner Triangle', description: 'A bold brand triangle anchoring the top-left corner.' },
  { key: 'ribbon', name: 'Diagonal Ribbon', description: 'A diagonal brand ribbon sweeping across the top corner.' },
  { key: 'waves', name: 'Waves', description: 'Layered wave bands flowing across the lower edge.' },
  { key: 'circuit', name: 'Circuit', description: 'Faint circuit-board traces for a technical, security feel.' },
  { key: 'mesh', name: 'Mesh Gradient', description: 'Soft overlapping colour blobs on a dark backdrop.' },
  { key: 'triangles', name: 'Low Poly', description: 'A faceted low-polygon pattern in brand tints.' },
  { key: 'terminal', name: 'Terminal', description: 'Dark console look with a window bar — hacker aesthetic.' },
  { key: 'shield', name: 'Shield', description: 'A large watermark shield emblem in the corner.' },
  { key: 'sidebar', name: 'Sidebar Panel', description: 'A full-height brand panel down the left side.' },
  { key: 'topaccent', name: 'Top Accent', description: 'Minimal cover with a slim gradient accent across the top.' },
];

const PAGE_BACKGROUNDS = [
  { key: 'white', name: 'White', swatch: '#ffffff' },
  { key: 'ivory', name: 'Ivory', swatch: '#faf7f0' },
  { key: 'cool-gray', name: 'Cool Gray', swatch: '#f4f6f8' },
  { key: 'brand-tint', name: 'Brand Tint', swatch: 'theme' },
  { key: 'warm-gray', name: 'Warm Gray', swatch: '#f5f4f2' },
  { key: 'slate-tint', name: 'Slate Tint', swatch: '#eef1f5' },
  { key: 'mint', name: 'Mint', swatch: '#f0f7f4' },
  { key: 'rose-tint', name: 'Rose Tint', swatch: '#fdf4f6' },
  { key: 'sky', name: 'Sky', swatch: '#eef5fb' },
  { key: 'sand', name: 'Sand', swatch: '#f7f3ea' },
  { key: 'lavender', name: 'Lavender', swatch: '#f4f1fb' },
  { key: 'dot-grid', name: 'Dot Grid', swatch: '#fbfbfc', css: 'radial-gradient(#e5e9ef 1.1px, transparent 1.3px) 0 0 / 22px 22px, #ffffff' },
  { key: 'grid-lines', name: 'Grid Lines', swatch: '#fbfbfc', css: 'repeating-linear-gradient(0deg,#eef1f5 0 1px,transparent 1px 24px), repeating-linear-gradient(90deg,#eef1f5 0 1px,transparent 1px 24px), #ffffff' },
  { key: 'soft-gradient', name: 'Soft Gradient', swatch: '#f6f8fb', css: 'linear-gradient(180deg,#ffffff 0%,#eef2f7 100%)' },
];

// `preview` tokens drive BOTH the Design-tab thumbnail and the actual pdf-lib drawing
// (see pdfMerge.js), so each header/footer style is defined in one place.
//   barPlace: 'both' | 'header' | 'footer'   barColor: 'brand' | 'dark' | 'accent' | 'tint'
//   rulePlace: 'both' | 'header' | 'footer'  ruleColor: 'brand' | 'accent'   double: true
//   edge: 'brand' | 'accent'                 text: 'muted' | 'brand'
const HEADER_FOOTER_STYLES = [
  { key: 'minimal', name: 'Minimal', description: 'Plain white bar with muted gray text (default).', preview: { text: 'muted' } },
  { key: 'brand-bar', name: 'Brand Bar', description: 'Solid brand-colored bar with white text.', preview: { barPlace: 'both', barColor: 'brand' } },
  { key: 'dark-bar', name: 'Dark Bar', description: 'Dark bar with light text.', preview: { barPlace: 'both', barColor: 'dark' } },
  { key: 'line-accent', name: 'Line Accent', description: 'White bar with a colored top/bottom rule.', preview: { rulePlace: 'both', ruleColor: 'brand', text: 'muted' } },
  { key: 'accent-bar', name: 'Accent Bar', description: 'Solid bar in the lighter accent colour.', preview: { barPlace: 'both', barColor: 'accent' } },
  { key: 'brand-footer', name: 'Brand Footer', description: 'Brand bar on the footer only; clean header.', preview: { barPlace: 'footer', barColor: 'brand', text: 'muted' } },
  { key: 'brand-header', name: 'Brand Header', description: 'Brand bar on the header only; clean footer.', preview: { barPlace: 'header', barColor: 'brand', text: 'muted' } },
  { key: 'edge-accent', name: 'Edge Accent', description: 'Thin brand strips at the very top and bottom edges.', preview: { edge: 'brand', text: 'muted' } },
  { key: 'double-rule', name: 'Double Rule', description: 'Two parallel brand rules, no fill.', preview: { rulePlace: 'both', ruleColor: 'brand', double: true, text: 'muted' } },
  { key: 'brand-text', name: 'Brand Text', description: 'No bar — header/footer text in the brand colour.', preview: { text: 'brand' } },
  { key: 'brand-rule', name: 'Brand Rule', description: 'Brand rule with brand-coloured text.', preview: { rulePlace: 'both', ruleColor: 'brand', text: 'brand' } },
  { key: 'tinted-bar', name: 'Tinted Bar', description: 'Soft brand-tint bar with brand-coloured text.', preview: { barPlace: 'both', barColor: 'tint' } },
  { key: 'accent-edge-bar', name: 'Accent Edge Bar', description: 'Brand bar framed by thin accent edge strips.', preview: { barPlace: 'both', barColor: 'brand', edge: 'accent' } },
  { key: 'dark-accent', name: 'Dark + Accent', description: 'Dark bar with a bright accent inner rule.', preview: { barPlace: 'both', barColor: 'dark', rulePlace: 'both', ruleColor: 'accent' } },
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
  { key: 'double', name: 'Double Rule', description: 'Bold name over two stacked brand rules.' },
  { key: 'overline', name: 'Overline', description: 'A brand rule sitting above the name.' },
  { key: 'bracket', name: 'Brackets', description: 'Name wrapped in brand-coloured brackets.' },
  { key: 'leftbar', name: 'Left Bar', description: 'A thick brand bar to the left of the name.' },
  { key: 'shadow', name: 'Soft Shadow', description: 'Bold name lifted with a soft drop shadow.' },
  { key: 'gradient', name: 'Gradient Text', description: 'Letters filled with a brand-to-accent gradient.' },
  { key: 'outline', name: 'Outlined', description: 'Hollow, outlined lettering.' },
  { key: 'pill', name: 'Pill Badge', description: 'White name inside a rounded brand pill.' },
  { key: 'tag', name: 'Tag', description: 'Name on a brand badge with a bright accent edge.' },
  { key: 'capsrule', name: 'Caps & Rule', description: 'Wide uppercase name above a full-width rule.' },
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
  if (!found) return '#ffffff';
  return found.css || found.swatch; // css = full `background` shorthand (patterns/gradients)
}

module.exports = {
  THEMES, COVER_STYLES, PAGE_BACKGROUNDS, HEADER_FOOTER_STYLES, COVER_ALIGNMENTS, WORDMARK_STYLES,
  getTheme, resolveTheme, buildCustomTheme, resolvePageBackground,
};
