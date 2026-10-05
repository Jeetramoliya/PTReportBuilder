const { XMLParser } = require('fast-xml-parser');

function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cdata(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object' && '__cdata' in node) return node.__cdata;
  return '';
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

const BURP_SEVERITY_MAP = { High: 'High', Medium: 'Medium', Low: 'Low', Information: 'Info' };

function parseBurp(xmlString) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata' });
  const doc = parser.parse(xmlString);
  const issues = asArray(doc?.issues?.issue);
  return issues.map((issue) => {
    const host = typeof issue.host === 'object' ? cdata(issue.host) || issue.host['#text'] || '' : issue.host || '';
    const pathVal = cdata(issue.path) || issue.path || '';
    return {
      title: cdata(issue.name) || issue.name || 'Untitled Finding',
      severity: BURP_SEVERITY_MAP[issue.severity] || 'Info',
      description: htmlToText(cdata(issue.issueBackground) || cdata(issue.issueDetail)),
      remediation: htmlToText(cdata(issue.remediationBackground) || cdata(issue.remediationDetail)),
      url: `${host}${pathVal}`.trim(),
      source: 'Burp Suite',
    };
  });
}

const NESSUS_RISK_MAP = { None: 'Info', Low: 'Low', Medium: 'Medium', High: 'High', Critical: 'Critical' };

function parseNessus(xmlString) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xmlString);
  const reports = asArray(doc?.NessusClientData_v2?.Report);
  const results = [];
  for (const report of reports) {
    const hosts = asArray(report?.ReportHost);
    for (const host of hosts) {
      const hostname = host['@_name'] || '';
      const items = asArray(host?.ReportItem).filter((item) => Number(item['@_severity']) > 0);
      for (const item of items) {
        results.push({
          title: item.pluginName || item['@_pluginName'] || 'Untitled Finding',
          severity: NESSUS_RISK_MAP[item.risk_factor] || 'Info',
          description: (item.synopsis ? `${item.synopsis}\n\n` : '') + (item.description || ''),
          remediation: item.solution || '',
          url: `${hostname}:${item['@_port'] || ''}`.trim(),
          source: 'Nessus',
        });
      }
    }
  }
  return results;
}

const NUCLEI_SEVERITY_MAP = { info: 'Info', low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

function parseNuclei(textContent) {
  const results = [];
  for (const line of textContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (e) {
      continue;
    }
    const info = obj.info || {};
    results.push({
      title: info.name || obj['template-id'] || 'Untitled Finding',
      severity: NUCLEI_SEVERITY_MAP[String(info.severity || '').toLowerCase()] || 'Info',
      description: info.description || '',
      remediation: (info.remediation || (Array.isArray(info.reference) ? info.reference.join('\n') : info.reference)) || '',
      url: obj['matched-at'] || obj.host || '',
      source: 'Nuclei',
    });
  }
  return results;
}

function detectAndParse(filename, content) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.nessus')) return parseNessus(content);
  if (lower.endsWith('.xml')) {
    if (content.includes('<issues') || content.includes('<issue>')) return parseBurp(content);
    if (content.includes('NessusClientData_v2')) return parseNessus(content);
    throw new Error('Unrecognized XML format. Expected a Burp Suite or Nessus export.');
  }
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.txt')) return parseNuclei(content);
  throw new Error('Unsupported file type. Upload a Burp (.xml), Nessus (.nessus), or Nuclei (.jsonl/.json) export.');
}

module.exports = { parseBurp, parseNessus, parseNuclei, detectAndParse };
