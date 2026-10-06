# VAPT Report Builder — container image for any host that runs a long-lived Node
# process (Render, Railway, Fly.io, a VPS, etc.).
#
# Data is stored in a Turso (libSQL) database when DATABASE_URL is set, so no persistent
# disk is required — the free tier of these hosts works. Without DATABASE_URL it falls back
# to a local SQLite file under DATA_DIR (needs a writable/persistent path).
#
# Ships a system Chromium so Puppeteer (PDF export) works without downloading its own.
FROM node:22-bookworm-slim

# Chromium + a broad set of fonts so the report's font choices render faithfully in the PDF.
# urw-base35 covers Times/Helvetica/Palatino/Century-style faces; carlito/caladea are
# metric-compatible with Calibri/Cambria; liberation2 + dejavu + noto cover the rest.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-liberation2 \
      fonts-dejavu-core \
      fonts-urw-base35 \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      fonts-noto-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use the distro Chromium and skip Puppeteer's own browser download.
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    DATA_DIR=/data \
    PORT=4173

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4173
CMD ["node", "server/index.js"]
