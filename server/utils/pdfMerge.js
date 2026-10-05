const { PDFDocument, PDFName, PDFArray, PDFDict, StandardFonts, rgb } = require('pdf-lib');

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

const HF_PRESETS = {
  minimal: { bar: false, textHex: '#5b6773', rule: false },
  'brand-bar': { bar: true, barHex: (t) => t.brand, textHex: '#ffffff', rule: false },
  'dark-bar': { bar: true, barHex: (t) => t.brandDark, textHex: '#ffffff', rule: false },
  'line-accent': { bar: false, textHex: '#5b6773', rule: true },
};

// Draws a full-bleed (edge-to-edge) header and footer onto the given pages using pdf-lib,
// so the coloured bar spans the entire page width instead of sitting inside the print
// margins (which is what Chromium's own header/footer templates do).
async function drawHeaderFooter(doc, data, startIndex) {
  const preset = HF_PRESETS[data.headerFooterStyle] || HF_PRESETS.minimal;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const textColor = hexToRgbColor(preset.textHex);
  const barColor = preset.bar ? hexToRgbColor(preset.barHex(data.theme)) : null;
  const accentColor = hexToRgbColor(data.theme.brand);

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

    if (preset.bar) {
      page.drawRectangle({ x: 0, y: headerCY - bandH / 2, width, height: bandH, color: barColor });
      page.drawRectangle({ x: 0, y: footerCY - bandH / 2, width, height: bandH, color: barColor });
    }
    if (preset.rule) {
      page.drawRectangle({ x: 0, y: headerCY - bandH / 2, width, height: 1.5, color: accentColor });
      page.drawRectangle({ x: 0, y: footerCY + bandH / 2, width, height: 1.5, color: accentColor });
    }

    // Header: title (left), tagline (right)
    if (reportTitle) page.drawText(reportTitle, { x: inset, y: textY(headerCY), size: fontSize, font, color: textColor });
    if (tagline) {
      const w = font.widthOfTextAtSize(tagline, fontSize);
      page.drawText(tagline, { x: width - inset - w, y: textY(headerCY), size: fontSize, font, color: textColor });
    }

    // Footer: client — tagline (left), page X of Y (right)
    if (footerLeft) page.drawText(footerLeft, { x: inset, y: textY(footerCY), size: fontSize, font, color: textColor });
    const pageLabel = `Page ${i + 1} of ${total}`;
    const plw = boldFont.widthOfTextAtSize(pageLabel, fontSize);
    page.drawText(pageLabel, { x: width - inset - plw, y: textY(footerCY), size: fontSize, font: boldFont, color: textColor });
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
