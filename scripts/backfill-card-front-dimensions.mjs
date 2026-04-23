/**
 * Однократно: записать frontImageWidth / frontImageHeight в data/cards.json
 * по реальным файлам в public/ (sharp). После этого рамка на витрине не ждёт клиентский замер.
 *
 * Запуск: node scripts/backfill-card-front-dimensions.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "data", "cards.json");

function safePath(p) {
  const s = String(p ?? "").trim();
  if (!s.startsWith("/uploads/")) return null;
  if (s.includes("..") || s.includes("\\")) return null;
  return s;
}

async function main() {
  const raw = fs.readFileSync(jsonPath, "utf8");
  const cards = JSON.parse(raw);
  if (!Array.isArray(cards)) {
    console.error("cards.json is not an array");
    process.exit(1);
  }
  let changed = 0;
  for (const c of cards) {
    if (c.frontImageWidth && c.frontImageHeight) continue;
    const pub = safePath(c.frontImage);
    if (!pub) continue;
    const fp = path.join(root, "public", pub.replace(/^\//, ""));
    try {
      const m = await sharp(fp).metadata();
      if (m.width && m.height && m.width > 0 && m.height > 0) {
        c.frontImageWidth = m.width;
        c.frontImageHeight = m.height;
        changed++;
      }
    } catch (e) {
      console.warn("skip", pub, e instanceof Error ? e.message : e);
    }
  }
  fs.writeFileSync(jsonPath, JSON.stringify(cards, null, 2), "utf-8");
  console.log(`backfill: wrote dimensions for ${changed} card(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
