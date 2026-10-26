import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { directory, root, saveJson } from "./printify-api.mjs";
import { selectPrintPositions } from "./print-positions.mjs";

const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const sharp = require("sharp");
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const palettes = {
  Evergreen: { background: "#121212", ink: "#FFD700", secondary: "#F6F3EB" },
  Halloween: { background: "#161021", ink: "#FF851B", secondary: "#A98ADD" },
  Thanksgiving: { background: "#302218", ink: "#D7A43C", secondary: "#CB673C" },
  Christmas: { background: "#123D32", ink: "#D9B65E", secondary: "#CE4250" },
};

function star(x, y, radius, color) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI * i / 5 - Math.PI / 2;
    const r = i % 2 ? radius * 0.43 : radius;
    return `${x + Math.cos(angle) * r},${y + Math.sin(angle) * r}`;
  }).join(" ");
  return `<polygon points="${points}" fill="${color}"/>`;
}

function icon(collection, color, secondary) {
  if (collection === "Halloween") {
    return `<g transform="translate(0,-340)">
      <path d="M-18-115L2-161L39-155L20-112" fill="${secondary}"/>
      <ellipse rx="166" ry="120" fill="${color}"/>
      <path d="M-90-35L-43-71L-32-18Z M90-35L43-71L32-18Z M-88 25L-45 48L-20 26L5 49L29 26L57 48L88 25L64 76L-59 76Z" fill="#161021"/>
      <path d="M-120-70Q-157 0-115 70 M-51-106Q-78 0-44 98 M51-106Q78 0 44 98 M120-70Q157 0 115 70" stroke="#161021" stroke-width="8" fill="none"/>
    </g>`;
  }
  if (collection === "Thanksgiving") {
    return `<g transform="translate(0,-340)">
      ${[-65, -32, 0, 32, 65].map((angle, i) =>
        `<path d="M0 118Q-100 25 0-133Q100 25 0 118Z" fill="${i % 2 ? secondary : color}" transform="rotate(${angle})"/>`).join("")}
      <path d="M0 145V-89" stroke="#302218" stroke-width="12"/>
    </g>`;
  }
  if (collection === "Christmas") {
    return `<g transform="translate(0,-340)">
      <path d="M-35-110V-141H35V-110" fill="${color}"/>
      <circle r="135" fill="${secondary}"/>
      ${star(0, 0, 81, color)}
      <path d="M-92-96Q-22-156 46-109" stroke="#F6F3EB" stroke-width="11" fill="none"/>
    </g>`;
  }
  return `<g transform="translate(0,-370)">
    <path d="M-170 0H-37L0 40L37-40L72 0H170" stroke="${color}" stroke-width="21" fill="none"/>
    <circle cx="-214" r="12" fill="${secondary}"/><circle cx="214" r="12" fill="${secondary}"/>
  </g>`;
}

function lettering(collection, ink, secondary, textInk, embroidery) {
  const text = (value, y, size, width, color = textInk) =>
    `<text x="0" y="${y}" text-anchor="middle" font-family="DejaVu Sans Condensed,DejaVu Sans" font-weight="900" font-size="${size}" textLength="${width}" lengthAdjust="spacingAndGlyphs" fill="${color}">${value}</text>`;
  if (embroidery) {
    return `<g>${text("SLESS", 65, 240, 770, ink)}${star(0, -160, 65, secondary)}</g>`;
  }
  const lines = collection === "Halloween"
    ? text("SLESS", -95, 147, 680, ink) + text("AFTER", 56, 124, 630) + text("DARK", 259, 178, 735, ink)
    : collection === "Thanksgiving"
      ? text("MORE", -73, 150, 690) + text("GRATITUDE", 135, 126, 880, ink)
      : collection === "Christmas"
        ? text("MORE", -73, 150, 690) + text("CHEER", 155, 183, 785, ink)
        : text("SLESS", -105, 165, 790) + text("IS", 52, 120, 210) + text("MORE", 252, 194, 790, ink);
  return icon(collection, ink, secondary) + lines +
    `<path d="M-385 323H385" stroke="${secondary}" stroke-width="9"/>` +
    text("SLESS IS MORE", 390, 43, 530) +
    `<path d="M-240 445H240" stroke="${ink}" stroke-width="7"/>`;
}

function makeSvg(product, position, width, height) {
  const palette = palettes[product.collection];
  const embroidery = position.decoration_method === "embroidery" ||
    product.category === "Headwear" || width / height > 5;
  const clothingColor = String(Object.values(product.variants[0].options || {})
    .find((value) => /black|white|natural|cream|ivory|sand/i.test(value)) || "");
  const dark = (/black/i.test(clothingColor) && !/straps/i.test(product.catalogTitle)) ||
    /Black Mug/i.test(product.catalogTitle);
  const fullBleed = /AOP|Backpack/i.test(product.catalogTitle) ||
    ["Home", "Desk and tech"].includes(product.category) ||
    product.category === "Drinkware";
  const textInk = fullBleed || dark ? "#F6F3EB" : "#171313";
  const ink = !fullBleed && !dark
    ? (product.collection === "Evergreen" ? "#171313" : palette.secondary)
    : palette.ink;
  const secondary = !fullBleed && !dark
    ? (product.collection === "Evergreen" ? "#B28418" : palette.ink)
    : palette.secondary;
  const scale = Math.min(width / 1250, height / (embroidery ? 620 : 1300));
  const allOver = /AOP|Backpack/i.test(product.catalogTitle);
  let pattern = "";
  if (fullBleed) {
    const spacing = Math.max(140, Math.min(width, height) / 6);
    const marks = [];
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        marks.push(star(x, y, spacing * 0.035, palette.secondary));
        marks.push(`<circle cx="${x + spacing * .28}" cy="${y + spacing * .31}" r="${spacing * .02}" fill="${palette.ink}"/>`);
        if (allOver) {
          marks.push(`<text x="${x}" y="${y + spacing * .2}" text-anchor="middle" font-family="DejaVu Sans Condensed,DejaVu Sans" font-weight="900" font-size="${spacing * .19}" fill="${palette.ink}">SLESS</text>`);
        }
      }
    }
    pattern = `<rect width="${width}" height="${height}" fill="${palette.background}"/><g opacity=".45">${marks.join("")}</g>`;
  }
  const design = lettering(product.collection, ink, secondary, textInk, embroidery);
  const wrap = product.category === "Drinkware" && width / height > 1.8;
  const centers = wrap ? [width * .25, width * .75] : [width / 2];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <title>${escape(product.listingTitle)} — original Sless artwork</title>${pattern}
    ${allOver ? "" : centers.map((center) => `<g transform="translate(${center},${height / 2}) scale(${scale})">${design}</g>`).join("")}
  </svg>`;
}

export async function renderArtwork(plan, { persist = true } = {}) {
  const out = resolve(directory, "merchandise-artwork");
  await mkdir(out, { recursive: true });
  for (const product of plan.products) {
    product.positions = selectPrintPositions(product, product.positions);
    product.artwork = [];
    for (const position of product.positions) {
      const width = Math.ceil(position.width), height = Math.ceil(position.height);
      if (width > 12000 || height > 12000 || width * height > 100_000_000) {
        throw new Error(`Print area too large to render safely: ${product.sku}/${position.position}`);
      }
      const svg = makeSvg(product, position, width, height);
      const hash = createHash("sha256").update(svg).digest("hex");
      const name = `${product.sku}-${position.position}-${hash.slice(0, 12)}`;
      const svgPath = resolve(out, `${name}.svg`);
      const pngPath = resolve(out, `${name}.png`);
      await writeFile(svgPath, svg);
      let cached = false;
      try { await stat(pngPath); cached = true; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!cached) {
        await sharp(Buffer.from(svg), { limitInputPixels: 100_000_000 })
          .png({ compressionLevel: 6 }).withMetadata({ density: 300 }).toFile(pngPath);
      }
      const metadata = await sharp(pngPath).metadata();
      if (metadata.width !== width || metadata.height !== height) throw new Error("Rendered image dimensions mismatch");
      product.artwork.push({ position: position.position, width, height, sha256: hash,
        svgPath: svgPath.replace(`${root}/`, ""), pngPath: pngPath.replace(`${root}/`, "") });
    }
    product.artworkStatus = "rendered_pending_proof_review";
    console.log(`ARTWORK_READY ${product.sku} positions=${product.artwork.length}`);
  }
  if (persist) await saveJson(resolve(directory, "merchandise-production-plan.json"), plan);
}

if (process.argv[1]?.endsWith("/artwork.mjs")) {
  const plan = JSON.parse(await readFile(resolve(directory, "merchandise-production-plan.json"), "utf8"));
  if (plan.status !== "providers_selected") throw new Error("A complete provider plan is required");
  await renderArtwork(plan);
  console.log(`ARTWORK_COMPLETE products=${plan.products.length}`);
}
