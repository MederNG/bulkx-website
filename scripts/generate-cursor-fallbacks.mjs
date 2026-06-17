/**
 * Generate PNG cursor fallbacks from public/cursor/mouse.svg.
 *
 *   npm run generate:cursor
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const cursorDir = path.join(process.cwd(), "public", "cursor");
const svgPath = path.join(cursorDir, "mouse.svg");
const pngSource = path.join(cursorDir, "mouse.png");

if (!fs.existsSync(svgPath) || !fs.existsSync(pngSource)) {
  console.error("Missing public/cursor/mouse.svg or mouse.png");
  process.exit(1);
}

const sizes = [32, 48, 64];

for (const size of sizes) {
  const out = path.join(cursorDir, `cursor-${size}.png`);
  await sharp(pngSource).resize(size, size, { fit: "contain" }).png().toFile(out);
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
}

console.log("Done. Fallback: cursor: url('/cursor/cursor-48.png') 12 12, auto;");
