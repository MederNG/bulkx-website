/**
 * Regenerate app/favicon.ico, app/icon.png, app/apple-icon.png from a source logo.
 *
 *   node scripts/generate-favicons.mjs path/to/logo.png
 *
 * Requires: sharp (bundled with Next.js) and devDependency to-ico.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import toIco from "to-ico";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("Usage: node scripts/generate-favicons.mjs <source-logo.png>");
  process.exit(1);
}

const appDir = path.join(process.cwd(), "app");

async function render(size) {
  return sharp(src).resize(size, size, { fit: "cover", position: "centre" }).png().toBuffer();
}

const png16 = await render(16);
const png32 = await render(32);
const png48 = await render(48);

await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(path.join(appDir, "icon.png"));
await sharp(src).resize(180, 180, { fit: "cover" }).png().toFile(path.join(appDir, "apple-icon.png"));
fs.writeFileSync(path.join(appDir, "favicon.ico"), await toIco([png16, png32, png48]));

console.log("Wrote app/favicon.ico, app/icon.png, app/apple-icon.png");
