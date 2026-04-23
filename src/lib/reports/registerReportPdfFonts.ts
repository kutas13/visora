import path from "path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Türkçe ı, ş, ğ, ö, ü, İ için Noto Sans (public/fonts) */
export function registerReportPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  registered = true;
}
