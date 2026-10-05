const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

function decodeToRgba(absPath) {
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.png') {
    const png = PNG.sync.read(buf);
    return { data: png.data, width: png.width, height: png.height };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    const img = jpeg.decode(buf, { useTArray: true });
    return { data: img.data, width: img.width, height: img.height };
  }
  return null;
}

function toHex(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

// Averages the most saturated, non-white/black/gray pixels to guess a brand accent color.
function extractDominantColor(absPath) {
  const decoded = decodeToRgba(absPath);
  if (!decoded) return null;

  const { data, width, height } = decoded;
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / 20000)); // sample for performance on large logos

  let vividSum = { r: 0, g: 0, b: 0 };
  let vividCount = 0;
  let fallbackSum = { r: 0, g: 0, b: 0 };
  let fallbackCount = 0;

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data.length > idx + 3 ? data[idx + 3] : 255;
    if (a < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const isNearWhite = min > 225;
    const isNearBlack = max < 30;
    const isGray = max - min < 18;

    fallbackSum.r += r; fallbackSum.g += g; fallbackSum.b += b;
    fallbackCount += 1;

    if (!isNearWhite && !isNearBlack && !isGray) {
      const saturationWeight = (max - min) / 255; // favor more saturated pixels
      vividSum.r += r * saturationWeight;
      vividSum.g += g * saturationWeight;
      vividSum.b += b * saturationWeight;
      vividCount += saturationWeight;
    }
  }

  let result;
  if (vividCount > 0.5) {
    result = { r: vividSum.r / vividCount, g: vividSum.g / vividCount, b: vividSum.b / vividCount };
  } else if (fallbackCount > 0) {
    result = { r: fallbackSum.r / fallbackCount, g: fallbackSum.g / fallbackCount, b: fallbackSum.b / fallbackCount };
  } else {
    return null;
  }

  return `#${toHex(result.r)}${toHex(result.g)}${toHex(result.b)}`;
}

module.exports = { extractDominantColor };
