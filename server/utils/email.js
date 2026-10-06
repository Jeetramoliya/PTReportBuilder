// Minimal transactional email via Resend's HTTP API (native fetch — no dependency).
// Configure with RESEND_API_KEY and MAIL_FROM (e.g. "VAPT <noreply@yourdomain.com>").
// If unset, email features are disabled rather than failing loudly.
function mailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

async function sendMail({ to, subject, html }) {
  if (!mailConfigured()) return { sent: false, reason: 'not_configured' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, html }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Email send failed (${r.status}): ${body.slice(0, 200)}`);
  }
  return { sent: true };
}

module.exports = { sendMail, mailConfigured };
