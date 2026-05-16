// Bu script public/seal/company-stamp.png dosyasini okur, 320x320 boyutuna
// kuculterek (asagidakinden buyukse) optimize PNG'e enkode eder ve base64
// dataURL olarak src/lib/statement/companyStamp.ts'ye yazar.
//
// Buyuk base64 imajlar @react-pdf/renderer Image componentinde sessiz olarak
// render edilemiyor (text yazisi gozuyor ama gorsel yok). 320x320 kucuk PNG
// hem dosya boyutunu (~30-50KB) hem de base64 length'i guvenli sinirda tutar.
//
// Kase guncellendiginde: `node scripts/gen-company-stamp.mjs` calistir.
// Build/dev oncesi `prebuild`/`predev` hook'lariyla otomatik calisir.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const SRC = path.join(ROOT, "public", "seal", "company-stamp.png");
const OUT = path.join(ROOT, "src", "lib", "statement", "companyStamp.ts");

const original = fs.readFileSync(SRC);

// Kose temiz olsun diye RGBA korunur. compressionLevel max, palette PNG'e
// donusturmek bazi durumlarda anti-aliasing'i bozar; bu nedenle truecolor.
// 240x240 + palette PNG → dosyayi cok kuculur (~10-25KB). react-pdf/renderer
// bu boyutta dataURL'leri sorunsuz embed eder.
const optimized = await sharp(original)
  .resize({ width: 240, height: 240, fit: "inside", withoutEnlargement: true })
  .png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,
    quality: 85,
    effort: 10,
  })
  .toBuffer();

const base64 = optimized.toString("base64");

const content =
  "// Otomatik uretildi. Bu dosyayi elle duzenlemeyin.\n" +
  "// Kaynak: public/seal/company-stamp.png (sharp ile 320x320'e kuculdurulmus)\n" +
  "// Yeniden olusturmak icin: `node scripts/gen-company-stamp.mjs`\n" +
  `// Orjinal boyut: ${original.length} byte, optimize: ${optimized.length} byte\n\n` +
  `export const COMPANY_STAMP_DATA_URL = "data:image/png;base64,${base64}";\n`;

fs.writeFileSync(OUT, content);
console.log(
  `OK -> ${OUT}\n` +
  `  png (orjinal): ${original.length} byte\n` +
  `  png (optimize): ${optimized.length} byte\n` +
  `  ts dosyasi: ${content.length} byte`
);
