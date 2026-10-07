const express = require('express');
const ExcelJS = require('exceljs');
const { buildReportData } = require('../utils/reportData');
const db = require('../db');

const router = express.Router();

async function ownsProject(id, userId) {
  return !!(await db.prepare('SELECT 1 FROM projects WHERE id = ? AND user_id = ?').get(id, userId));
}

const COLUMNS = [
  { header: 'Identifier', key: 'identifier', width: 16 },
  { header: 'Title', key: 'title', width: 32 },
  { header: 'Category', key: 'category', width: 22 },
  { header: 'OWASP Category', key: 'owasp_category', width: 30 },
  { header: 'CWE', key: 'cwe_id', width: 12 },
  { header: 'Scope', key: 'scope_type', width: 18 },
  { header: 'Severity', key: 'severity', width: 12 },
  { header: 'Risk Rating', key: 'risk_rating', width: 12 },
  { header: 'Likelihood', key: 'likelihood', width: 12 },
  { header: 'Impact', key: 'impact', width: 12 },
  { header: 'CVSS Score', key: 'cvss_score', width: 12 },
  { header: 'CVSS Vector', key: 'cvss_vector', width: 34 },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Affected URLs', key: 'urls', width: 40 },
  { header: 'Description', key: 'description', width: 50 },
  { header: 'Remediation', key: 'remediation', width: 50 },
];

const SEVERITY_ARGB = {
  Critical: 'FF7F1D1D', High: 'FFB91C1C', Medium: 'FFD97706', Low: 'FF2563EB', Info: 'FF6B7280', None: 'FF6B7280',
};

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get('/projects/:id/findings.csv', async (req, res, next) => {
  try {
    if (!(await ownsProject(req.params.id, req.userId))) return res.status(404).json({ error: 'Project not found' });
    const data = await buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const rows = [COLUMNS.map((c) => c.header)];
    for (const f of data.findings) {
      rows.push(COLUMNS.map((c) => {
        if (c.key === 'urls') return f.affected_urls.map((u) => u.url).join(' | ');
        return f[c.key];
      }));
    }
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

    const filename = `${(data.project.name || 'findings').replace(/[^a-z0-9\-_]+/gi, '_')}_findings.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  } catch (e) {
    next(e);
  }
});

const JIRA_PRIORITY = { Critical: 'Highest', High: 'High', Medium: 'Medium', Low: 'Low', Info: 'Lowest', None: 'Lowest' };

// Jira CSV import format (Summary, Issue Type, Priority, Description, Labels).
router.get('/projects/:id/jira.csv', async (req, res, next) => {
  try {
    if (!(await ownsProject(req.params.id, req.userId))) return res.status(404).json({ error: 'Project not found' });
    const data = await buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });
    const header = ['Summary', 'Issue Type', 'Priority', 'Description', 'Labels'];
    const rows = [header];
    for (const f of data.findings) {
      const desc = [
        f.description || '',
        f.remediation ? `\n\nRemediation:\n${f.remediation}` : '',
        f.affected_urls.length ? `\n\nAffected:\n${f.affected_urls.map((u) => u.url).join('\n')}` : '',
        f.cvss_vector ? `\n\nCVSS: ${f.cvss_score} (${f.cvss_vector})` : '',
      ].join('');
      const labels = [f.owasp_category ? f.owasp_category.split('-')[0] : '', f.cwe_id, ...(f.compliance_tags || [])].filter(Boolean).join(' ').replace(/\s+/g, '-');
      rows.push([`${f.identifier}: ${f.title}`, 'Bug', JIRA_PRIORITY[f.severity] || 'Medium', desc, labels]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const filename = `${(data.project.name || 'findings').replace(/[^a-z0-9\-_]+/gi, '_')}_jira.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  } catch (e) { next(e); }
});

// GitHub-flavoured Markdown: one issue block per finding, ready to paste.
router.get('/projects/:id/github.md', async (req, res, next) => {
  try {
    if (!(await ownsProject(req.params.id, req.userId))) return res.status(404).json({ error: 'Project not found' });
    const data = await buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });
    const md = data.findings.map((f) => {
      const lines = [`## ${f.identifier}: ${f.title}`, '', `**Severity:** ${f.severity} · **Risk:** ${f.risk_rating}${f.cvss_score ? ` · **CVSS:** ${f.cvss_score}` : ''}`, ''];
      if (f.owasp_category || f.cwe_id) lines.push(`**OWASP:** ${f.owasp_category || '—'} · **CWE:** ${f.cwe_id || '—'}`, '');
      lines.push('### Description', f.description || '_None_', '');
      if (f.affected_urls.length) lines.push('### Affected', ...f.affected_urls.map((u) => `- \`${u.url}\``), '');
      lines.push('### Remediation', f.remediation || '_None_', '');
      if (f.compliance_tags && f.compliance_tags.length) lines.push(`**Compliance:** ${f.compliance_tags.join(', ')}`, '');
      return lines.join('\n');
    }).join('\n\n---\n\n');
    const filename = `${(data.project.name || 'findings').replace(/[^a-z0-9\-_]+/gi, '_')}_github.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`# ${data.project.name} — Findings\n\n${md}\n`);
  } catch (e) { next(e); }
});

router.get('/projects/:id/findings.xlsx', async (req, res, next) => {
  try {
    if (!(await ownsProject(req.params.id, req.userId))) return res.status(404).json({ error: 'Project not found' });
    const data = await buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VAPT Report Builder';
    const sheet = workbook.addWorksheet('Findings');
    sheet.columns = COLUMNS;

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };

    for (const f of data.findings) {
      const row = sheet.addRow({
        identifier: f.identifier,
        title: f.title,
        category: f.category,
        owasp_category: f.owasp_category,
        cwe_id: f.cwe_id,
        scope_type: f.scope_type,
        severity: f.severity,
        risk_rating: f.risk_rating,
        likelihood: f.likelihood,
        impact: f.impact,
        cvss_score: f.cvss_score || '',
        cvss_vector: f.cvss_vector,
        status: f.status,
        urls: f.affected_urls.map((u) => u.url).join('\n'),
        description: f.description,
        remediation: f.remediation,
      });
      const sevCell = row.getCell('severity');
      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEVERITY_ARGB[f.severity] || 'FF6B7280' } };
      sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      row.getCell('urls').alignment = { wrapText: true };
      row.getCell('description').alignment = { wrapText: true };
      row.getCell('remediation').alignment = { wrapText: true };
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const filename = `${(data.project.name || 'findings').replace(/[^a-z0-9\-_]+/gi, '_')}_findings.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
