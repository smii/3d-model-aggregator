import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "..", "public", "icons");
const sourceSvg = readFileSync(path.join(iconsDir, "icon-source.svg"));
const BACKGROUND = "#09090b";

async function main() {
  await sharp(sourceSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "icon-192.png"));

  await sharp(sourceSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-512.png"));

  // Maskable icons need the artwork padded inside a safe zone (~80% of the
  // canvas) so Android's adaptive-icon mask doesn't clip it.
  const size = 512;
  const glyphSize = Math.round(size * 0.7);
  const glyphBuffer = await sharp(sourceSvg).resize(glyphSize, glyphSize).toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: glyphBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, "icon-maskable-512.png"));

  console.log("Generated icon-192.png, icon-512.png, icon-maskable-512.png");
}

main();
