# Deploying VAPT Report Builder

This app is a **long-lived Node server** that generates PDFs with headless Chromium
(Puppeteer). It stores all data — accounts, projects, findings, and uploaded
logos/screenshots — in a **libSQL database**. Two ways to provide that database:

- **Turso (recommended for free hosting):** a hosted libSQL database. Because the data
  (including images) lives in Turso, the host needs **no persistent disk**, so free tiers
  work. Set `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
- **Local SQLite file (default):** if `DATABASE_URL` is not set, the app uses a local
  `node:sqlite` file under `DATA_DIR`. This needs a writable/persistent path (a VPS disk or
  a mounted volume) and Node 22.5+.

It needs a host that runs a persistent Node process (not request-per-invocation
serverless), and Chromium for Puppeteer (the provided Dockerfile installs it).

## ⚠️ Why not Vercel / Netlify functions

Serverless platforms give each request an **ephemeral, mostly read-only filesystem**, and
full Chromium does not run there, so PDF export fails. Use one of the hosts below.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | libSQL/Turso URL (`libsql://...` or `https://...`). When set, all data is stored there and no disk is needed. |
| `DATABASE_AUTH_TOKEN` | — | Auth token for the Turso database. |
| `DATA_DIR` | project root | Only used for the local-file fallback (when `DATABASE_URL` is unset): base dir for `$DATA_DIR/data/vapt.db`. |
| `PORT` | `4173` | Port to listen on (most hosts set this automatically). |
| `NODE_ENV` | — | Set to `production` so the session cookie is marked `Secure` (HTTPS only). |
| `PUPPETEER_EXECUTABLE_PATH` | Puppeteer's bundled Chromium | Path to a system Chromium (the Dockerfile sets `/usr/bin/chromium`). |
| `RESEND_API_KEY` | — | Optional. Resend API key to enable password-reset emails. Without it, password reset is disabled (change-password while signed in still works). |
| `MAIL_FROM` | — | Optional. Sender for reset emails, e.g. `VAPT <noreply@yourdomain.com>` (must be a Resend-verified sender). |
| `ADMIN_EMAILS` | — | Comma-separated emails that get the admin panel (view all users + their report counts, remove users). An account is an admin purely by matching this list. |
| `ADMIN_PASSWORD` | — | Optional. If set together with `ADMIN_EMAILS`, any missing admin accounts are seeded on boot with this password. (Otherwise just sign up with an admin email.) |

## Recommended: Render (free) + Turso (free) — no credit card

### 1. Create a free Turso database

1. Sign up at <https://turso.tech> (GitHub login, no card).
2. Install the CLI and create a database:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   turso db create ptreportbuilder
   ```
3. Get the two values you'll paste into Render:
   ```bash
   turso db show ptreportbuilder --url          # -> DATABASE_URL  (libsql://...)
   turso db tokens create ptreportbuilder       # -> DATABASE_AUTH_TOKEN
   ```
   (You can also do all of this from the Turso web dashboard if you prefer not to install
   the CLI — create a database, then copy its URL and create a token.)

   The app creates its own tables on first start, so no schema setup is needed.

### 2. Deploy to Render

1. Push this repo to GitHub (already done).
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` and builds the
   `Dockerfile` on the **free** plan.
3. When prompted, set the two environment variables:
   - `DATABASE_URL` = the `libsql://...` URL from step 1
   - `DATABASE_AUTH_TOKEN` = the token from step 1
4. Deploy. Open the URL, create an account, and you're done.

> Render's free web service sleeps after inactivity and cold-starts on the next request
> (the first PDF after a sleep may take a few extra seconds). Your data is safe either way
> because it lives in Turso, not on the instance.

## Alternative hosts

Railway and Fly.io work the same way — deploy the `Dockerfile` and set `DATABASE_URL` +
`DATABASE_AUTH_TOKEN` (plus `NODE_ENV=production`). No volume is needed when using Turso.

### Any VPS (local SQLite file, no Turso)

On a normal server the filesystem persists, so you can skip Turso entirely:

```bash
git clone https://github.com/Jeetramoliya/PTReportBuilder.git
cd PTReportBuilder
npm ci
NODE_ENV=production node server/index.js
```

Put it behind a reverse proxy (Caddy/Nginx) for HTTPS. Node 22.5+ is required (the local
fallback uses the built-in `node:sqlite` module). Back up `$DATA_DIR/data/vapt.db`.

## After deploying

- Each person visits the URL and **creates their own account** — projects are private
  per user, so teammates never see each other's data.
- With Turso, back up with `turso db shell ptreportbuilder .dump > backup.sql` periodically.
