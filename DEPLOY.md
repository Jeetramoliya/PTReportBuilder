# Deploying VAPT Report Builder

This app is a **long-lived Node server** that stores data in SQLite on disk, saves
uploaded logos/screenshots to disk, and generates PDFs with headless Chromium
(Puppeteer). It needs:

1. A host that runs a persistent Node process (not request-per-invocation serverless).
2. A **persistent disk** mounted for the data directory.
3. Chromium available for Puppeteer (the provided Dockerfile installs it).

## ⚠️ Why not Vercel / Netlify functions

Serverless platforms give each request an **ephemeral, mostly read-only filesystem**, so
the SQLite database and uploaded files would not survive between requests, and full
Chromium does not run there. Accounts/projects would vanish and PDF export would fail.
Use one of the hosts below instead.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `DATA_DIR` | project root | Base dir for the SQLite DB (`$DATA_DIR/data/vapt.db`) and uploads (`$DATA_DIR/uploads`). Point this at your mounted volume. |
| `PORT` | `4173` | Port to listen on (most hosts set this automatically). |
| `NODE_ENV` | — | Set to `production` so the session cookie is marked `Secure` (HTTPS only). |
| `PUPPETEER_EXECUTABLE_PATH` | Puppeteer's bundled Chromium | Path to a system Chromium (the Dockerfile sets `/usr/bin/chromium`). |

## Option A — Render (Docker + persistent disk)

1. Push this repo to GitHub (already done).
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml`, builds the
   `Dockerfile`, and mounts a 1 GB disk at `/data`.
3. Deploy. Open the URL, create an account, and you're done.

> A persistent disk needs a paid instance type (Starter+). The free tier has no
> persistent storage, so data would reset on each deploy.

## Option B — Railway

1. **New Project → Deploy from GitHub repo.** Railway detects the `Dockerfile`.
2. Add a **Volume** and set its mount path to `/data`.
3. Add env var `DATA_DIR=/data` (and `NODE_ENV=production`). Deploy.

## Option C — Fly.io

```bash
fly launch --no-deploy        # detects the Dockerfile
fly volumes create data --size 1
```
Add to `fly.toml`:
```toml
[env]
  DATA_DIR = "/data"
  NODE_ENV = "production"

[mounts]
  source = "data"
  destination = "/data"
```
Then `fly deploy`.

## Option D — Any VPS (no Docker)

On a normal server the filesystem already persists, so no volume is needed:

```bash
git clone https://github.com/Jeetramoliya/PTReportBuilder.git
cd PTReportBuilder
npm ci
NODE_ENV=production node server/index.js
```

Put it behind a reverse proxy (Caddy/Nginx) for HTTPS. Node 22.5+ is required (the app
uses the built-in `node:sqlite` module).

## After deploying

- Each person visits the URL and **creates their own account** — projects are private
  per user, so teammates never see each other's data.
- Back up the `DATA_DIR` volume periodically; it holds all reports and evidence.
