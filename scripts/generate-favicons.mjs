/**
 * Regenerate app/favicon.ico, app/icon.png, app/apple-icon.png from a source logo.
 *
 *   node scripts/generate-favicons.mjs path/to/logo.png
 *
 * Requires: sharp (bundled with Next.js) and devDependency png-to-ico.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("Usage: node scripts/generate-favicons.mjs <source-logo.png>");
  process.exit(1);
}

const appDir = path.join(process.cwd(), "app");
const tmpDir = path.join(process.cwd(), ".tmp-icons");

async function renderToFile(size, filename) {
  const out = path.join(tmpDir, filename);
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(out);
  return out;
}

fs.mkdirSync(tmpDir, { recursive: true });

const png16 = await renderToFile(16, "16.png");
const png32 = await renderToFile(32, "32.png");
const png48 = await renderToFile(48, "48.png");

await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(path.join(appDir, "icon.png"));
await sharp(src).resize(180, 180, { fit: "cover" }).png().toFile(path.join(appDir, "apple-icon.png"));
fs.writeFileSync(path.join(appDir, "favicon.ico"), await pngToIco([png16, png32, png48]));

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Wrote app/favicon.ico, app/icon.png, app/apple-icon.png");
