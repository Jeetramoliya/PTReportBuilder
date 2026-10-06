const { PDFDocument, PDFName, PDFArray, PDFDict, StandardFonts, rgb } = require('pdf-lib');
const { HEADER_FOOTER_STYLES } = require('./themes');

const HF_BY_KEY = Object.fromEntries(HEADER_FOOTER_STYLES.map((s) => [s.key, s]));

function hexToRgbColor(hex) {
  const m = String(hex || '#ffffff').replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const int = parseInt(full || 'ffffff', 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// Sanitize to WinAnsi-safe text (the standard Helvetica font can't encode em-dashes etc.)
function safe(str) {
  return String(str == null ? '' : str)
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '');
}

// Resolves a colour token (from a header/footer style's `preview`) against the active theme.
function tokenColor(token, theme) {
  if (token === 'brand') return theme.brand;
  if (token === 'dark') return theme.brandDark;
  if (token === 'accent') return theme.accent;
  if (token === 'tint') return theme.brandLight;
  return null;
}

// Draws a full-bleed (edge-to-edge) header and footer onto the given pages using pdf-lib,
// so the coloured bar spans the entire page width instead of sitting inside the print
// margins (which is what Chromium's own header/footer templates do). The look is driven by
// the chosen style's `preview` tokens (see HEADER_FOOTER_STYLES in themes.js).
async function drawHeaderFooter(doc, data, startIndex) {
  const style = HF_BY_KEY[data.headerFooterStyle] || HF_BY_KEY.minimal || {};
  const pv = style.preview || {};
  const theme = data.theme;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const headerHasBar = pv.barPlace === 'both' || pv.barPlace === 'header';
  const footerHasBar = pv.barPlace === 'both' || pv.barPlace === 'footer';
  const headerHasRule = pv.rulePlace === 'both' || pv.rulePlace === 'header';
  const footerHasRule = pv.rulePlace === 'both' || pv.rulePlace === 'footer';

  const barColor = pv.barColor ? hexToRgbColor(tokenColor(pv.barColor, theme)) : null;
  const ruleColor = pv.ruleColor ? hexToRgbColor(tokenColor(pv.ruleColor, theme)) : null;
  const edgeColor = pv.edge ? hexToRgbColor(tokenColor(pv.edge, theme)) : null;

  // Text on a coloured bar is white (or brand on a light tint); otherwise muted grey or brand.
  const plainHex = pv.text === 'brand' ? theme.brand : '#5b6773';
  const onBarHex = pv.barColor === 'tint' ? theme.brand : '#ffffff';
  const headerTextColor = hexToRgbColor(headerHasBar ? onBarHex : plainHex);
  const footerTextColor = hexToRgbColor(footerHasBar ? onBarHex : plainHex);

  const bandH = 26;
  const inset = 28;
  const fontSize = 8;

  const reportTitle = safe(data.project.report_title || data.project.name);
  const tagline = safe(data.project.tagline);
  const clientName = safe(data.project.client_name || data.project.name);
  const footerLeft = tagline ? `${clientName} - ${tagline}` : clientName;

  const pages = doc.getPages();
  const total = pages.length;

  for (let i = startIndex; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const headerCY = height - 30;   // vertical centre of the header band
    const footerCY = 40;            // vertical centre of the footer band
    const textY = (cy) => cy - fontSize / 2 + 1;

    if (headerHasBar) page.drawRectangle({ x: 0, y: headerCY - bandH / 2, width, height: bandH, color: barColor });
    if (footerHasBar) page.drawRectangle({ x: 0, y: footerCY - bandH / 2, width, height: bandH, color: barColor });

    if (headerHasRule) {
      page.drawRectangle({ x: 0, y: headerCY - bandH / 2, width, height: 1.5, color: ruleColor });
      if (pv.double) page.drawRectangle({ x: 0, y: headerCY - bandH / 2 - 4, width, height: 1.5, color: ruleColor });
    }
    if (footerHasRule) {
      page.drawRectangle({ x: 0, y: footerCY + bandH / 2, width, height: 1.5, color: ruleColor });
      if (pv.double) page.drawRectangle({ x: 0, y: footerCY + bandH / 2 + 4, width, height: 1.5, color: ruleColor });
    }
    if (edgeColor) {
      page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: edgeColor });
      page.drawRectangle({ x: 0, y: 0, width, height: 6, color: edgeColor });
    }

    // Header: title (left), tagline (right)
    if (reportTitle) page.drawText(reportTitle, { x: inset, y: textY(headerCY), size: fontSize, font, color: headerTextColor });
    if (tagline) {
      const w = font.widthOfTextAtSize(tagline, fontSize);
      page.drawText(tagline, { x: width - inset - w, y: textY(headerCY), size: fontSize, font, color: headerTextColor });
    }

    // Footer: client — tagline (left), page X of Y (right)
    if (footerLeft) page.drawText(footerLeft, { x: inset, y: textY(footerCY), size: fontSize, font, color: footerTextColor });
    const pageLabel = `Page ${i + 1} of ${total}`;
    const plw = boldFont.widthOfTextAtSize(pageLabel, fontSize);
    page.drawText(pageLabel, { x: width - inset - plw, y: textY(footerCY), size: fontSize, font: boldFont, color: footerTextColor });
  }
}

// Rewrites the Table-of-Contents link annotations so each one points at the correct
// physical page in the merged document. We do this deterministically from an
// anchor -> page-number map (computed during the measurement pass) rather than relying
// on named-destination tables surviving the cover/rest merge.
function remapTocLinks(doc, tocPageIndex, anchorToPage) {
  const pages = doc.getPages();
  if (tocPageIndex < 0 || tocPageIndex >= pages.length) return;
  const tocPage = pages[tocPageIndex];
  const annotsRef = tocPage.node.get(PDFName.of('Annots'));
  if (!annotsRef) return;
  const annots = tocPage.node.lookup(PDFName.of('Annots'), PDFArray);

  for (let i = 0; i < annots.size(); i++) {
    const annot = doc.context.lookup(annots.get(i), PDFDict);
    if (!annot) continue;

    // Figure out the anchor name from either /Dest or /A -> /D
    let anchorName = null;
    const dest = annot.get(PDFName.of('Dest'));
    if (dest && dest.constructor.name === 'PDFName') {
      anchorName = dest.asString ? dest.asString() : dest.toString();
    } else {
      const action = annot.get(PDFName.of('A'));
      if (action) {
        const actDict = doc.context.lookup(action, PDFDict);
        const d = actDict && actDict.get(PDFName.of('D'));
        if (d && d.constructor.name === 'PDFName') anchorName = d.asString ? d.asString() : d.toString();
      }
    }
    if (!anchorName) continue;
    const clean = anchorName.replace(/^\//, '');
    const targetPage = anchorToPage[clean];
    if (!targetPage) continue;

    const targetRef = pages[targetPage - 1].ref;
    const explicit = PDFArray.withContext(doc.context);
    explicit.push(targetRef);
    explicit.push(PDFName.of('Fit'));
    annot.set(PDFName.of('Dest'), explicit);
    // Drop any competing /A action so viewers use our explicit /Dest.
    if (annot.get(PDFName.of('A'))) annot.delete(PDFName.of('A'));
  }
}

async function buildMergedDocument(coverBuffer, restBuffer) {
  const coverDoc = await PDFDocument.load(coverBuffer);
  const restDoc = await PDFDocument.load(restBuffer);

  const merged = await PDFDocument.create();
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach((p) => merged.addPage(p));
  const restPages = await merged.copyPages(restDoc, restDoc.getPageIndices());
  restPages.forEach((p) => merged.addPage(p));

  return merged;
}

module.exports = { buildMergedDocument, drawHeaderFooter, remapTocLinks };
