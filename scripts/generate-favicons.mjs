/**
 * Visora favicon ureteci
 *
 *  - public/visora-logo.png (~789KB) tek basina favicon olarak Google'in
 *    SERP'ine cikmiyor: cok buyuk, ratio ve "purpose" Google rehberine
 *    uygun degil. Bu script logodan:
 *      - app/icon.png        (32x32  — varsayilan favicon, browser tab)
 *      - app/icon-192.png    (192x192 — manifest icin)
 *      - app/apple-icon.png  (180x180 — iOS home screen)
 *      - public/favicon.ico  (32x32  — eski tarayici/Google fallback)
 *      - public/icon-512.png (512x512 — manifest icin)
 *    cikti olusturur.
 *
 *  Calistirmak icin: `node scripts/generate-favicons.mjs`
 */

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public", "visora-logo.png");
const APP_DIR = path.join(ROOT, "src", "app");
const PUBLIC_DIR = path.join(ROOT, "public");

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/**
 * Logoyu kare alanin %88'ini kaplayacak sekilde, kose yumusatma olmadan,
 * seffaf arka plan uzerinde yerlestirir. Boylece favicon kucuk boyutlarda
 * bile tanir kalir.
 */
async function renderSquare(size) {
  const padding = Math.round(size * 0.06); // %6 nefes payi
  const inner = size - padding * 2;

  const logoBuf = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Cok kucuk bir ICO kucagi. Sharp dogrudan ICO yazmiyor, ama
 * 32x32 PNG'yi `.ico` uzantisiyla kaydetmek modern tarayicilarda calisir.
 * Yine de en saglam yontem icin gercek bir ICO uretmek lazim — bunu
 * bir sonraki adimda 'png-to-ico' ile cozeriz.
 */
async function main() {
  await ensureDir(APP_DIR);
  await ensureDir(PUBLIC_DIR);

  // Tum favicon dosyalari public/ altinda; metadata.icons URL'leri ile
  // birebir ayni isim/uzanti kullaniyoruz. Boylece /icon-192.png gibi
  // URL'ler Next.js'in dosya bazli rota mekanizmasiyla cakismaz.
  const px32 = await renderSquare(32);
  await writeFile(path.join(PUBLIC_DIR, "icon.png"), px32);

  const px180 = await renderSquare(180);
  await writeFile(path.join(PUBLIC_DIR, "apple-icon.png"), px180);

  const px192 = await renderSquare(192);
  await writeFile(path.join(PUBLIC_DIR, "icon-192.png"), px192);

  const px512 = await renderSquare(512);
  await writeFile(path.join(PUBLIC_DIR, "icon-512.png"), px512);

  // favicon.ico icin ayri bir adim: png-to-ico paketini kullan.
  // Eger paket yuklu degilse, gecici olarak 32x32 PNG'yi favicon.ico
  // adiyla kaydederiz (cogu tarayicida calisir).
  let icoWritten = false;
  try {
    const mod = await import("png-to-ico");
    const pngToIco = mod.default || mod;
    const ico = await pngToIco([px32]);
    await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), ico);
    icoWritten = true;
  } catch {
    await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), px32);
  }

  console.log(
    "✅ Favicon dosyalari uretildi (hepsi public/ altinda):" +
    "\n  - public/favicon.ico       " + (icoWritten ? "(true ICO, 32x32)" : "(PNG fallback)") +
    "\n  - public/icon.png          (32x32)" +
    "\n  - public/apple-icon.png    (180x180)" +
    "\n  - public/icon-192.png      (192x192)" +
    "\n  - public/icon-512.png      (512x512)"
  );
}

main().catch((e) => {
  console.error("Favicon uretimi basarisiz:", e);
  process.exit(1);
});
