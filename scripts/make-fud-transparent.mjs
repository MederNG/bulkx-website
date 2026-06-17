/**
 * Removes connected near-black background from fud-popup.png.
 * Run: node scripts/make-fud-transparent.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, "../public/fud-popup.png");
const output = input;

const BG_THRESHOLD = 32;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const total = width * height;
const isBackground = new Uint8Array(total);

function pixelIndex(x, y) {
  return (y * width + x) * 4;
}

function isDarkPixel(i) {
  return Math.max(data[i], data[i + 1], data[i + 2]) <= BG_THRESHOLD;
}

const queue = [];

for (let x = 0; x < width; x += 1) {
  queue.push(x, (height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  queue.push(y * width, y * width + (width - 1));
}

while (queue.length) {
  const pos = queue.pop();
  if (isBackground[pos]) continue;

  const x = pos % width;
  const y = Math.floor(pos / width);
  const i = pixelIndex(x, y);
  if (!isDarkPixel(i)) continue;

  isBackground[pos] = 1;
  if (x > 0) queue.push(pos - 1);
  if (x < width - 1) queue.push(pos + 1);
  if (y > 0) queue.push(pos - width);
  if (y < height - 1) queue.push(pos + width);
}

for (let pos = 0; pos < total; pos += 1) {
  if (!isBackground[pos]) continue;
  data[pos * 4 + 3] = 0;
}

await sharp(data, {
  raw: { width, height, channels: 4 },
})
  .png()
  .toFile(output + ".tmp");

fs.renameSync(output + ".tmp", output);
console.log("Wrote transparent fud-popup.png");
