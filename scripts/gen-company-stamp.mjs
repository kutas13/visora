// Bu script public/seal/company-stamp.png dosyasini okur,
// base64'e cevirir ve src/lib/statement/companyStamp.ts olarak yazar.
// Boylece Vercel/serverless ortamlarda fs.readFileSync(public/...)
// sorunlari yasansa bile kase her zaman PDF'e gomulur.
//
// Kase guncellendiginde: `node scripts/gen-company-stamp.mjs` calistir.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const SRC = path.join(ROOT, "public", "seal", "company-stamp.png");
const OUT = path.join(ROOT, "src", "lib", "statement", "companyStamp.ts");

const buf = fs.readFileSync(SRC);
const base64 = buf.toString("base64");

const content =
  "// Otomatik uretildi. Bu dosyayi elle duzenlemeyin.\n" +
  "// Kaynak: public/seal/company-stamp.png\n" +
  "// Yeniden olusturmak icin: `node scripts/gen-company-stamp.mjs`\n" +
  `// Boyut: ${buf.length} byte\n\n` +
  `export const COMPANY_STAMP_DATA_URL = "data:image/png;base64,${base64}";\n`;

fs.writeFileSync(OUT, content);
console.log(`OK -> ${OUT} (${content.length} bytes)`);
