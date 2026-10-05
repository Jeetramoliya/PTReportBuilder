const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size').default || require('image-size');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  ImageRun, WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak, VerticalAlign,
} = require('docx');

const { resolveUpload } = require('../paths');

function hex(c) {
  return String(c || '#000000').replace('#', '').toUpperCase();
}

const SEVERITY_HEX = {
  Critical: '7F1D1D', High: 'B91C1C', Medium: 'D97706', Low: '2563EB', Info: '6B7280', None: '6B7280',
};

function noBorders() {
  const b = { style: BorderStyle.SINGLE, size: 2, color: 'D7DDE3' };
  return { top: b, bottom: b, left: b, right: b };
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts.colSpan,
    shading: opts.header ? { fill: opts.headerColor || 'EEF3F8', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: noBorders(),
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold || !!opts.header, color: opts.header ? opts.brand : undefined })],
      }),
    ],
  });
}

function badgeCell(severity) {
  return new TableCell({
    shading: { fill: SEVERITY_HEX[severity] || '6B7280', type: ShadingType.CLEAR, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    borders: noBorders(),
    children: [new Paragraph({ children: [new TextRun({ text: severity, bold: true, color: 'FFFFFF' })] })],
  });
}

function heading(text, level, brand) {
  return new Paragraph({
    heading: level,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text, bold: true, color: brand })],
  });
}

function para(text, opts = {}) {
  const lines = String(text ?? '').split('\n');
  return lines.map((l) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: l, italics: opts.italic, color: opts.color })] }));
}

function bulletList(items) {
  return items.map((t) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 80 } }));
}

function imageRunFromFile(relPath, maxWidth) {
  try {
    const abs = resolveUpload(relPath);
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    const dims = sizeOf(buf);
    const ext = (path.extname(abs).slice(1) || 'png').toLowerCase();
    const type = ['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'png';
    let width = dims.width || maxWidth;
    let height = dims.height || Math.round(maxWidth * 0.5);
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    return new ImageRun({ type, data: buf, transformation: { width, height } });
  } catch (e) {
    return null;
  }
}

function buildDocx(data) {
  const { project, theme, scopeItems, findings, severityCounts, totalFindings, findingsWithRetests } = data;
  const brand = hex(theme.brand);

  const children = [];

  // ---- Cover ----
  if (project.logo_path) {
    const logo = imageRunFromFile(project.logo_path, 260);
    if (logo) children.push(new Paragraph({ children: [logo], spacing: { after: 300 } }));
  }
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: project.report_title, bold: true, size: 56, color: brand })],
  }));
  children.push(new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: project.report_subtitle || 'Vulnerability Assessment & Penetration Testing Report', size: 26, color: '5B6773' })],
  }));
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: new Date(project.assessment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22 })],
  }));
  if (project.iteration_label) {
    children.push(new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: project.iteration_label, bold: true, color: brand, size: 20 })] }));
  }
  children.push(new Paragraph({
    spacing: { before: 600, after: 40 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: brand } },
    children: [new TextRun({ text: project.client_name || '—', bold: true, size: 24 })],
  }));
  if (project.client_address) {
    for (const line of project.client_address.split('\n')) {
      children.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    }
  }
  if (project.client_website) children.push(new Paragraph({ children: [new TextRun({ text: project.client_website })] }));
  children.push(new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: project.prepared_by_org || '', color: '5B6773' })],
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: project.tagline || '', color: '5B6773' })] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Table of Contents ----
  children.push(heading('Table of Contents', HeadingLevel.HEADING_1, brand));
  ['1. Executive Summary', '2. Assessment Scope', '3. Methodology', '4. Risk Rating', '5. Vulnerabilities Identified'].forEach((t) => {
    children.push(new Paragraph({ text: t, spacing: { after: 80 } }));
  });
  findings.forEach((f, i) => {
    children.push(new Paragraph({ text: `5.${i + 1} ${f.identifier}: ${f.title}`, indent: { left: 360 }, spacing: { after: 60 }, style: 'muted' }));
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Executive Summary ----
  children.push(heading('1. Executive Summary', HeadingLevel.HEADING_1, brand));
  children.push(...para(project.executive_summary));
  const execHeaderRow = new TableRow({
    tableHeader: true,
    children: ['Identifier', 'Vulnerability', 'Category', 'Risk Rating', 'CVSS', 'Alerts'].map((t) => cell(t, { header: true, brand })),
  });
  const execRows = findings.map((f) => new TableRow({
    children: [
      cell(f.identifier),
      cell(f.title),
      cell(f.category || '—'),
      badgeCell(f.severity),
      cell(f.cvss_score ? f.cvss_score.toFixed(1) : '—'),
      cell(String(Math.max(f.affected_urls.length, 1))),
    ],
  }));
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [execHeaderRow, ...execRows] }));
  children.push(new Paragraph({ text: '', spacing: { after: 160 } }));

  children.push(heading('Vulnerabilities by Severity', HeadingLevel.HEADING_2, brand));
  const sevRow = new TableRow({ children: ['Critical', 'High', 'Medium', 'Low', 'Info'].map((s) => cell(s, { header: true, brand })) });
  const sevCountRow = new TableRow({ children: ['Critical', 'High', 'Medium', 'Low', 'Info'].map((s) => cell(String(severityCounts[s] || 0))) });
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [sevRow, sevCountRow] }));
  children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: `Total findings: ${totalFindings} across ${scopeItems.length} scoped target(s).`, italics: true, color: '5B6773' })] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Assessment Scope ----
  children.push(heading('2. Assessment Scope', HeadingLevel.HEADING_1, brand));
  children.push(...para('The following targets and applications were included within the scope of this assessment.'));
  if (!scopeItems.length) {
    children.push(...para('No scope items recorded.', { italic: true, color: '5B6773' }));
  } else {
    const groups = [];
    for (const s of scopeItems) {
      let g = groups.find((x) => x.name === (s.group_name || 'Scope'));
      if (!g) { g = { name: s.group_name || 'Scope', items: [] }; groups.push(g); }
      g.items.push(s);
    }
    for (const g of groups) {
      children.push(heading(g.name, HeadingLevel.HEADING_2, brand));
      const isApp = g.items.every((i) => i.item_type === 'app');
      const cols = isApp
        ? ['Application Name', 'Version', 'Platform']
        : ['Tenant', 'URL / Target'];
      if (project.iteration_label) cols.push('Iteration');
      const header = new TableRow({ tableHeader: true, children: cols.map((t) => cell(t, { header: true, brand })) });
      const rows = g.items.map((i) => {
        const vals = isApp ? [i.app_name, i.app_version || '—', i.platform || '—'] : [i.tenant, i.url];
        if (project.iteration_label) vals.push(project.iteration_label);
        return new TableRow({ children: vals.map((v) => cell(v)) });
      });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Methodology ----
  children.push(heading('3. Methodology', HeadingLevel.HEADING_1, brand));
  const lines = (project.methodology || '').split('\n').filter((l) => l.trim().length);
  const bulletLines = lines.filter((l) => l.trim().startsWith('-'));
  const paraLines = lines.filter((l) => !l.trim().startsWith('-'));
  paraLines.forEach((l) => children.push(...para(l)));
  if (bulletLines.length) children.push(...bulletList(bulletLines.map((l) => l.replace(/^-\s*/, ''))));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Risk Rating ----
  children.push(heading('4. Risk Rating', HeadingLevel.HEADING_1, brand));
  children.push(...para('Each finding is assigned a risk rating based on the likelihood of exploitation and the impact of a successful attack, consistent with the approach described in OWASP guidance and NIST SP 800-30. Where applicable, the Common Vulnerability Scoring System (CVSS v3.1) is used to provide an additional, standardized severity score from 0-10.'));
  const matrixHeader = new TableRow({ tableHeader: true, children: ['', 'Low Impact', 'Medium Impact', 'High Impact'].map((t) => cell(t, { header: true, brand })) });
  const matrixRows = [
    ['High Likelihood', 'Low', 'Medium', 'High'],
    ['Medium Likelihood', 'Low', 'Medium', 'High'],
    ['Low Likelihood', 'Low', 'Low', 'Medium'],
  ].map((r) => new TableRow({ children: [cell(r[0], { bold: true }), cell(r[1]), cell(r[2]), cell(r[3])] }));
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [matrixHeader, ...matrixRows] }));
  children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  children.push(heading('Likelihood', HeadingLevel.HEADING_2, brand));
  children.push(...para('High — Exploitation requires no special skills or motivation; proof-of-concept code or tooling is readily available.\nMedium — Exploitation requires some skill and motivation, or non-default configuration.\nLow — Exploitation requires specialized skills, high privileges, or is otherwise impractical for most attackers.'));
  children.push(heading('Impact', HeadingLevel.HEADING_2, brand));
  children.push(...para('High — Could allow an attacker to gain elevated privileges, execute arbitrary code, or access/exfiltrate sensitive data.\nMedium — Could disrupt business operations in the short term or partially compromise the system.\nLow — No meaningful additional access is gained and operations are not disrupted.'));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Vulnerabilities Identified Summary ----
  children.push(heading('5. Vulnerabilities Identified', HeadingLevel.HEADING_1, brand));
  children.push(...para('The following vulnerabilities were identified during manual and automated testing.'));
  const vulnHeader = new TableRow({ tableHeader: true, children: ['Vulnerability', 'Severity', 'Description', 'Count'].map((t) => cell(t, { header: true, brand })) });
  const vulnRows = findings.map((f) => new TableRow({
    children: [cell(f.title), badgeCell(f.severity), cell(f.description), cell(String(Math.max(f.affected_urls.length, 1)))],
  }));
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [vulnHeader, ...vulnRows] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Retest Summary ----
  if (findingsWithRetests.length) {
    children.push(heading('Retest Summary', HeadingLevel.HEADING_1, brand));
    children.push(...para('The following findings have recorded retest activity since they were originally identified.'));
    findingsWithRetests.forEach((f) => {
      children.push(heading(`${f.identifier}: ${f.title} (${f.status})`, HeadingLevel.HEADING_2, brand));
      const header = new TableRow({ tableHeader: true, children: ['Date', 'Previous Status', 'New Status', 'Notes'].map((t) => cell(t, { header: true, brand })) });
      const rows = f.retest_events.map((ev) => new TableRow({
        children: [cell(ev.event_date), cell(ev.previous_status), cell(ev.new_status), cell(ev.notes || '—')],
      }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ---- Individual Findings ----
  findings.forEach((f, idx) => {
    children.push(heading(`5.${idx + 1} ${f.identifier}: ${f.title}`, HeadingLevel.HEADING_1, brand));

    const infoRows = [
      new TableRow({ children: [cell('Identifier', { bold: true }), cell(f.identifier), cell('Impact', { bold: true }), cell(f.impact), cell('Risk Rating', { bold: true }), badgeCell(f.severity)] }),
      new TableRow({ children: [cell('Scope', { bold: true }), cell(f.scope_type || 'Web Application'), cell('Likelihood', { bold: true }), cell(f.likelihood), cell('CVSS Score', { bold: true }), cell(f.cvss_score ? f.cvss_score.toFixed(1) : 'N/A')] }),
    ];
    if (f.category) infoRows.push(new TableRow({ children: [cell('Category', { bold: true }), cell(f.category, { colSpan: 5 })] }));
    if (f.owasp_category || f.cwe_id) {
      infoRows.push(new TableRow({ children: [cell('OWASP', { bold: true }), cell(f.owasp_category || '—'), cell('CWE', { bold: true }), cell(f.cwe_id || '—', { colSpan: 3 })] }));
    }
    if (f.cvss_vector) infoRows.push(new TableRow({ children: [cell('CVSS Vector', { bold: true }), cell(f.cvss_vector, { colSpan: 5 })] }));
    infoRows.push(new TableRow({ children: [cell('Status', { bold: true }), cell(f.status, { colSpan: 5 })] }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: infoRows }));
    children.push(new Paragraph({ text: '', spacing: { after: 120 } }));

    children.push(heading('Description', HeadingLevel.HEADING_2, brand));
    children.push(...para(f.description || 'No description provided.'));

    children.push(heading('Vulnerable Endpoint(s)', HeadingLevel.HEADING_2, brand));
    if (f.affected_urls.length) {
      children.push(...bulletList(f.affected_urls.map((u) => u.url)));
    } else {
      children.push(...para('No affected URLs recorded.', { italic: true, color: '5B6773' }));
    }

    children.push(heading('Proof of Concept / Reproduction Steps', HeadingLevel.HEADING_2, brand));
    if (f.poc_steps.length) {
      f.poc_steps.forEach((step, i) => {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun({ text: step.step_text || '' })] }));
        if (step.payload) {
          children.push(new Paragraph({
            shading: { fill: '1F2933', type: ShadingType.CLEAR, color: 'auto' },
            spacing: { after: 100 },
            children: [new TextRun({ text: step.payload, color: 'E6EDF3', font: 'Consolas' })],
          }));
        }
        if (step.screenshot_path) {
          const img = imageRunFromFile(step.screenshot_path, 420);
          if (img) children.push(new Paragraph({ spacing: { after: 160 }, children: [img] }));
        }
      });
    } else {
      children.push(...para('No reproduction steps recorded.', { italic: true, color: '5B6773' }));
    }

    children.push(heading('Suggested Remediation', HeadingLevel.HEADING_2, brand));
    children.push(...para(f.remediation || 'No remediation provided.'));

    if (f.references.length) {
      children.push(heading('References', HeadingLevel.HEADING_2, brand));
      children.push(...bulletList(f.references.map((r) => `${r.label} — ${r.url}`)));
    }

    if (idx < findings.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  });

  const bgHex = hex(data.pageBackground || '#ffffff');
  const doc = new Document({
    background: bgHex === 'FFFFFF' ? undefined : { color: bgHex },
    styles: {
      default: {
        document: { run: { font: data.font.docxName || 'Calibri', size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
