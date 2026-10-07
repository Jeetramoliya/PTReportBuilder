// Tiny, safe Markdown -> HTML for finding descriptions/remediation. Everything is
// HTML-escaped first, so this can never inject markup; only a known-safe subset of tags is
// produced. Links are limited to http(s). Not a full CommonMark parser — just the basics
// pentesters use: bold, italic, inline code, fenced code, lists, headings, links.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(src) {
  const lines = esc(src).split('\n');
  let html = '';
  let inCode = false;
  let listType = null;
  const codeBuf = [];
  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) { html += `<pre class="md-code">${codeBuf.join('\n')}</pre>`; codeBuf.length = 0; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (/^\s*$/.test(line)) { closeList(); continue; }
    let m;
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${inline(m[1])}</li>`; continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${inline(m[1])}</li>`; continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { closeList(); html += `<strong>${inline(m[2])}</strong><br/>`; continue; }
    closeList();
    html += `${inline(line)}<br/>`;
  }
  if (inCode) html += `<pre class="md-code">${codeBuf.join('\n')}</pre>`;
  closeList();
  return html;
}

module.exports = { markdownToHtml };

if (require.main === module) {
  const assert = require('assert');
  assert.ok(markdownToHtml('**bold**').includes('<strong>bold</strong>'));
  assert.ok(markdownToHtml('a `code` b').includes('<code>code</code>'));
  assert.ok(markdownToHtml('- one\n- two').includes('<ul><li>one</li><li>two</li></ul>'));
  assert.ok(!markdownToHtml('<script>alert(1)</script>').includes('<script>'), 'must escape HTML');
  assert.ok(!markdownToHtml('[x](javascript:alert(1))').includes('href'), 'only http(s) links');
  console.log('markdown self-check ok');
}
