# VAPT Report Builder — container image for any host that runs a long-lived Node
# process with a persistent volume (Render, Railway, Fly.io, a VPS, etc.).
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

# Persistent data (SQLite database + uploaded logos/screenshots) lives here — mount a
# volume at /data so it survives restarts and redeploys.
VOLUME ["/data"]

EXPOSE 4173
CMD ["node", "server/index.js"]
