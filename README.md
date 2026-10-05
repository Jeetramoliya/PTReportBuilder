# VAPT Report Builder

A local web app for pentesters to manage engagements, record findings and evidence, and generate a professional client-ready PDF report — styled after a standard VAPT report layout (cover page, executive summary with severity chart, scope, methodology, risk matrix, and per-finding evidence pages).

## Requirements

- Node.js 22.5+ (uses the built-in `node:sqlite` module — no native build tools required)

## Setup

```bash
npm install
npm start
```

Then open http://localhost:4173

## What you can do

- **Projects** — one per engagement. Set client name/address/website, report title, an optional report subtitle (e.g. "Web Application & Desktop Client Tool") and iteration/report ID (e.g. "PI-2025-Q3_3", shown as a badge on the cover page), assessment date, tester name, and upload a company logo.
- **Scope** — organize scope into named groups (e.g. "Web API Endpoints", "Desktop Client Tool"), each holding either URL/tenant rows or application name/version/platform rows — matching how multi-component engagements (web + desktop + APIs) are actually scoped.
- **Findings** — for each vulnerability: an editable identifier (auto-suggested, e.g. `WEB-1`, but freely renameable to match a client's own naming convention like `FX_25Q33-1`), title, category, a Scope field (Web Application / API / Desktop Client / etc.), description, remediation, Likelihood/Impact (auto-computes a Low/Medium/High risk rating), and an optional full CVSS v3.1 calculator (pick the 8 base metrics, get a live score/vector/severity).
- **Evidence** — add vulnerable endpoints, numbered proof-of-concept steps each with an optional payload/code snippet (rendered as a distinct code block, e.g. an XSS payload) and an optional screenshot, and reference links.
- **Design** — a dedicated tab to pick:
  - a **color theme** (8 presets — Navy, Crimson, Emerald, Violet, Slate, Amber, Teal, Charcoal — or "Use Logo Color as Theme" to auto-extract an accent color from your uploaded PNG/JPEG logo);
  - a **cover page style** — 8 designs: Classic, Gradient, Hero Band, Geometric, Dark Mode, Split (diagonal two-tone), Frame (bordered), Side Stripe;
  - a **report font** (Modern Sans, Classic Serif, Corporate, Technical/mono);
  - a **page background color** for content pages (White, Ivory, Cool Gray, or a tint of your theme color — the cover page keeps its own dedicated design regardless);
  - a **header/footer style** (Minimal, Brand Bar, Dark Bar, Line Accent) for the running bar on every PDF page.

  A live scaled-down cover preview updates as you pick. Severity colors always stay fixed regardless of theme, since they carry semantic meaning.
- **Draft watermark** — an optional diagonal "DRAFT"/"CONFIDENTIAL"/custom stamp across every PDF page, sized to fit automatically.
- **OWASP / CWE tagging** — tag each finding with an OWASP Top 10 (2021) category and a CWE ID; the executive summary gets an auto-generated "vulnerabilities by OWASP category" chart alongside the severity chart.
- **Finding templates** — start a new finding from 20+ pre-filled common vulnerability templates (SQLi, XSS, CSRF, IDOR, SSRF, XXE, broken auth, path traversal, etc.), each with a sensible category, OWASP/CWE tag, CVSS vector, description and remediation you can then edit.
- **Scanner import** — upload a Burp Suite XML export, a Nessus (`.nessus`) export, or a Nuclei JSON Lines output; parsed findings are shown for review (title/severity/description/remediation/URL) so you can pick which ones to create before anything is saved.
- **Retest tracking** — log a retest against any finding (new status, date, notes); the report gets a "Retest Summary" section listing status history for every finding that's been retested.
- **Findings export** — download the findings table as CSV or a styled Excel (.xlsx) workbook (severity-colored cells, frozen header row) for tracking outside the tool.
- **Report generation** — "Preview Report" opens the full HTML report in a new tab. The Export menu offers:
  - **PDF** — rendered with Puppeteer (headless Chromium), paginated with headers/footers, and a real Table of Contents with accurate page numbers (built via a two-pass render: the report is generated once to measure where each section lands, then regenerated with those page numbers filled in).
  - **DOCX** — an editable Word version built natively with the `docx` library (real tables, embedded images, no HTML conversion) so the client or your team can mark it up directly in Word.
- **Password protection** — optional, app-wide (not per-project accounts, since this is a local single-user tool by design). Set a password from the "Security" link on the dashboard; once set, every page and API route requires signing in via `/login.html`, backed by an HttpOnly session cookie.

All finding/PoC text is HTML-escaped before rendering, so a payload like `<script>...</script>` in your evidence is shown as literal text in the report rather than being executed.

## Data storage

- Metadata is stored in a local SQLite file at `data/vapt.db`.
- Uploaded logos and screenshots are stored under `uploads/`.

Both are gitignored by default so engagement evidence isn't accidentally committed.
