const FONTS = {
  sans: { key: 'sans', name: 'Modern Sans (Segoe UI)', stack: "'Segoe UI', Arial, Helvetica, sans-serif", docxName: 'Segoe UI' },
  serif: { key: 'serif', name: 'Classic Serif (Georgia)', stack: "Georgia, 'Times New Roman', Times, serif", docxName: 'Georgia' },
  corporate: { key: 'corporate', name: 'Corporate (Calibri)', stack: "Calibri, 'Trebuchet MS', Verdana, sans-serif", docxName: 'Calibri' },
  mono: { key: 'mono', name: 'Technical (Consolas)', stack: "Consolas, 'Courier New', monospace", docxName: 'Consolas' },
  elegant: { key: 'elegant', name: 'Elegant (Book Antiqua)', stack: "'Book Antiqua', Palatino, 'Palatino Linotype', Georgia, serif", docxName: 'Book Antiqua' },
  wide: { key: 'wide', name: 'Wide (Verdana)', stack: "Verdana, Tahoma, Geneva, sans-serif", docxName: 'Verdana' },
};

function getFont(key) {
  return FONTS[key] || FONTS.sans;
}

module.exports = { FONTS, getFont };
