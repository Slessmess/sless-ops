/** Compose an honest same-scale comparison from the supplier's real front mockups. */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, relative } from "node:path";
import { directory, root } from "./printify-api.mjs";
const require = createRequire(new URL("../../../artifacts/api-server/package.json", import.meta.url));
const sharp = require("sharp");
const output = resolve(root, "attached_assets/generated_images/halloween-large-proof");
const proof = JSON.parse(await fs.readFile(resolve(directory, "halloween-large-proof.json"), "utf8"));
if (!proof.liveProductUnchangedVerified || proof.nativeChannelLinked || proof.publicationAuthorized) {
  throw new Error("Expected verified unpublished proof only");
}
const audit = JSON.parse(await fs.readFile(resolve(directory, "shirt-image-audit.json"), "utf8"));
const colors = [
  { name: "Purple", id: 12017 },
  { name: "Black", id: 12125 },
  { name: "Orange", id: 12011 },
];
const cards = [];
for (const [index, color] of colors.entries()) {
  const previous = audit.printify.images.find(i => i.position === "front" && i.variant_ids.includes(color.id));
  if (!previous) throw new Error("Original front mockup unavailable");
  const response = await fetch(previous.src, { signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("Original mockup download failed");
  }
  const currentBytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(resolve(output, `current-${color.name.toLowerCase()}-supplier.jpg`), currentBytes);
  const newer = proof.mockups.find(i => i.variantId === color.id);
  if (!newer) throw new Error("Proposed front mockup unavailable");
  const proposedBytes = await fs.readFile(resolve(root, newer.file));
  const x = 40 + index * 580;
  cards.push(`<text x="${x + 280}" y="225" text-anchor="middle" class="color">${color.name.toUpperCase()}</text>
    <rect x="${x}" y="245" width="560" height="500" rx="4" fill="white"/>
    <image href="data:image/jpeg;base64,${proposedBytes.toString("base64")}" x="${x + 30}" y="245" width="500" height="500" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${x}" y="835" width="560" height="500" rx="4" fill="white"/>
    <image href="data:image/jpeg;base64,${currentBytes.toString("base64")}" x="${x + 30}" y="835" width="500" height="500" preserveAspectRatio="xMidYMid meet"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1800" height="1460">
<style>text{font-family:DejaVu Sans,Arial,sans-serif;fill:#f6f3eb}.title{font-size:48px;font-weight:800}.sub{font-size:23px;fill:#b8b5ad}.label{font-size:23px;font-weight:800;letter-spacing:2px}.color{font-size:22px;font-weight:800;letter-spacing:4px}.foot{font-size:21px;fill:#b8b5ad}</style>
<rect width="1800" height="1460" fill="#10100e"/>
<text x="40" y="48" class="label" style="fill:#ffd700">SLESS AFTER DARK</text>
<text x="40" y="108" class="title">LARGER PRINT — APPROVAL PROOF</text>
<text x="40" y="143" class="sub">Approved design, enhanced for a larger front print. Transparent shaped edge retained.</text>
<rect x="40" y="165" width="1720" height="37" fill="#ffd700"/>
<text x="56" y="191" class="label" style="fill:#10100e">PROPOSED · APPROX. 10.5 IN WIDE</text>
${cards.join("")}
<text x="40" y="801" class="label">CURRENT · APPROX. 6.75 IN WIDE</text>
<text x="40" y="1388" class="foot">Supplier-rendered front mockups at the same photo scale. AI-enhanced upscale, not a physical print sample.</text>
<text x="40" y="1424" class="foot">PROOF ONLY — The live shirt and original canvas have not been changed.</text>
</svg>`;
const file = resolve(output, "larger-shirt-three-color-proof.jpg");
await sharp(Buffer.from(svg)).jpeg({ quality: 94, mozjpeg: true }).toFile(file);
console.log(JSON.stringify({ proof: relative(root, file), colors: colors.map(c => c.name),
  liveProductChanged: false, published: false }));
