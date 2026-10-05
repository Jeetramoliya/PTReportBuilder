# VAPT Report Builder — container image for any host that runs a long-lived Node
# process (Render, Railway, Fly.io, a VPS, etc.).
#
# Data is stored in a Turso (libSQL) database when DATABASE_URL is set, so no persistent
# disk is required — the free tier of these hosts works. Without DATABASE_URL it falls back
# to a local SQLite file under DATA_DIR (needs a writable/persistent path).
#
# Ships a system Chromium so Puppeteer (PDF export) works without downloading its own.
FROM node:22-bookworm-slim

# Chromium + the fonts/libs it needs to render PDFs headlessly.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
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
