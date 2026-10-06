const FONTS = {
  sans: { key: 'sans', name: 'Modern Sans (Segoe UI)', stack: "'Segoe UI', Arial, Helvetica, sans-serif", docxName: 'Segoe UI' },
  serif: { key: 'serif', name: 'Classic Serif (Georgia)', stack: "Georgia, 'Times New Roman', Times, serif", docxName: 'Georgia' },
  corporate: { key: 'corporate', name: 'Corporate (Calibri)', stack: "Calibri, 'Trebuchet MS', Verdana, sans-serif", docxName: 'Calibri' },
  mono: { key: 'mono', name: 'Technical (Consolas)', stack: "Consolas, 'Courier New', monospace", docxName: 'Consolas' },
  elegant: { key: 'elegant', name: 'Elegant (Book Antiqua)', stack: "'Book Antiqua', Palatino, 'Palatino Linotype', Georgia, serif", docxName: 'Book Antiqua' },
  wide: { key: 'wide', name: 'Wide (Verdana)', stack: "Verdana, Tahoma, Geneva, sans-serif", docxName: 'Verdana' },
  garamond: { key: 'garamond', name: 'Garamond (Serif)', stack: "Garamond, 'EB Garamond', 'Times New Roman', serif", docxName: 'Garamond' },
  cambria: { key: 'cambria', name: 'Cambria (Serif)', stack: "Cambria, Georgia, 'Times New Roman', serif", docxName: 'Cambria' },
  times: { key: 'times', name: 'Times New Roman', stack: "'Times New Roman', Times, serif", docxName: 'Times New Roman' },
  helvetica: { key: 'helvetica', name: 'Helvetica (Sans)', stack: "Helvetica, Arial, sans-serif", docxName: 'Helvetica' },
  tahoma: { key: 'tahoma', name: 'Tahoma (Sans)', stack: "Tahoma, Geneva, Verdana, sans-serif", docxName: 'Tahoma' },
  trebuchet: { key: 'trebuchet', name: 'Trebuchet MS', stack: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif", docxName: 'Trebuchet MS' },
  century: { key: 'century', name: 'Century Gothic', stack: "'Century Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif", docxName: 'Century Gothic' },
  franklin: { key: 'franklin', name: 'Franklin Gothic', stack: "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif", docxName: 'Franklin Gothic Medium' },
  courier: { key: 'courier', name: 'Courier (Mono)', stack: "'Courier New', Courier, monospace", docxName: 'Courier New' },
  lucida: { key: 'lucida', name: 'Lucida Sans', stack: "'Lucida Sans', 'Lucida Grande', 'Segoe UI', sans-serif", docxName: 'Lucida Sans' },
};

function getFont(key) {
  return FONTS[key] || FONTS.sans;
}

module.exports = { FONTS, getFont };
