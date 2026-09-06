import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "recap");
const outFile = path.join(outDir, "pre-deposits-recap.png");

const familjen = fs
  .readFileSync(path.join(root, "fonts", "FamiljenGrotesk-VariableFont_wght.ttf"))
  .toString("base64");
const mono = fs
  .readFileSync(path.join(root, "fonts", "OverpassMono-VariableFont_wght.ttf"))
  .toString("base64");
const logoInner = fs
  .readFileSync(path.join(root, "public", "logos", "bulkx-logo-light.svg"), "utf8")
  .replace(/<\/?svg[^>]*>/g, "")
  .trim();

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style><![CDATA[
      @font-face {
        font-family: "Familjen";
        src: url(data:font/ttf;base64,${familjen}) format("truetype");
        font-weight: 100 900;
      }
      @font-face {
        font-family: "OverpassMono";
        src: url(data:font/ttf;base64,${mono}) format("truetype");
        font-weight: 100 900;
      }
      .label {
        font-family: Familjen, sans-serif;
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        fill: #8b8580;
      }
      .label-dim { fill: #6b6660; }
      .value {
        font-family: Familjen, sans-serif;
        font-size: 36px;
        font-weight: 600;
        letter-spacing: -0.7px;
        fill: #f5f3ee;
      }
      .value-gold { fill: #ffb547; }
      .sub {
        font-family: OverpassMono, monospace;
        font-size: 13px;
        fill: #c9c4bd;
      }
      .sub-gold { fill: #ffb547; }
      .tagline {
        font-family: Familjen, sans-serif;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.2px;
        fill: #f5f3ee;
      }
      .footer {
        font-family: OverpassMono, monospace;
        font-size: 11px;
        fill: #6b6660;
      }
    ]]></style>
    <radialGradient id="g1" cx="12%" cy="-8%" r="70%" fx="12%" fy="-8%">
      <stop offset="0%" stop-color="#ffb547" stop-opacity="0.14"/>
      <stop offset="58%" stop-color="#ffb547" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="92%" cy="108%" r="55%" fx="92%" fy="108%">
      <stop offset="0%" stop-color="#6b8cae" stop-opacity="0.12"/>
      <stop offset="55%" stop-color="#6b8cae" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="675" rx="16" fill="#0b0b0c"/>
  <rect width="1200" height="675" rx="16" fill="url(#g1)"/>
  <rect width="1200" height="675" rx="16" fill="url(#g2)"/>

  <g transform="translate(40,36)">
    <g transform="translate(0,0)">${logoInner}</g>
    <text class="label label-dim" x="95" y="21">Intelligence</text>
    <text class="label" x="1120" y="21" text-anchor="end">Pre-Deposits Recap</text>
  </g>

  <!-- Card 1 -->
  <g transform="translate(40,160)">
    <rect width="360" height="200" rx="12" fill="#121214"/>
    <rect x="0.5" y="0.5" width="359" height="1" fill="rgba(255,255,255,0.08)"/>
    <text class="label" x="24" y="32">Participants</text>
    <text class="value" x="24" y="92">13.9K</text>
    <text class="sub" x="24" y="136">wallets joined the</text>
    <text class="sub" x="24" y="158">pre-deposit campaign</text>
  </g>

  <!-- Card 2 -->
  <g transform="translate(420,160)">
    <rect width="360" height="200" rx="12" fill="#121214"/>
    <rect x="0.5" y="0.5" width="359" height="1" fill="rgba(255,255,255,0.08)"/>
    <text class="label" x="24" y="32">Capital Flow</text>
    <text class="value" x="24" y="92">$91M</text>
    <text class="sub" x="24" y="136">flowed through the campaign</text>
    <text class="sub-gold" x="24" y="158">$41M peak TVL</text>
  </g>

  <!-- Card 3 -->
  <g transform="translate(800,160)">
    <rect width="360" height="200" rx="12" fill="#121214"/>
    <rect x="0.5" y="0.5" width="359" height="1" fill="rgba(255,255,255,0.08)"/>
    <text class="label" x="24" y="32">Aura Distributed</text>
    <text class="value value-gold" x="24" y="92">13.6M</text>
    <text class="sub-gold" x="24" y="136">88%</text>
    <text class="sub" x="70" y="136">went to pre-depositors</text>
  </g>

  <line x1="40" y1="420" x2="1160" y2="420" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <text class="tagline" x="600" y="500" text-anchor="middle">Pretty fucking solid for a pre-launch campaign. 👀</text>
  <text class="footer" x="600" y="545" text-anchor="middle">aurabulk.xyz · data as of Aug 29, 2026</text>
</svg>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "pre-deposits-recap.svg"), svg);

await sharp(Buffer.from(svg))
  .png()
  .toFile(outFile);

console.log(`Wrote ${outFile}`);
