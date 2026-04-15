import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ULKE_PDF_MAP: Record<string, string> = {
  "Fransa": "fransa.pdf",
  "Hollanda": "hollanda.pdf",
  "Bulgaristan": "bulgaristan.pdf",
  "İtalya": "italya.pdf",
  "Almanya": "almanya.pdf",
  "İspanya": "ispanya.pdf",
  "Avusturya": "avusturya.pdf",
  "Belçika": "belcika.pdf",
  "Portekiz": "portekiz.pdf",
  "Yunanistan": "yunanistan.pdf",
  "İsviçre": "isvicre.pdf",
  "Polonya": "polonya.pdf",
  "Çekya": "cekya.pdf",
  "Macaristan": "macaristan.pdf",
  "Danimarka": "danimarka.pdf",
  "İsveç": "isvec.pdf",
  "Norveç": "norvec.pdf",
  "Finlandiya": "finlandiya.pdf",
  "Slovakya": "slovakya.pdf",
  "Hırvatistan": "hirvatistan.pdf",
  "Malta": "malta.pdf",
};

function formatTrDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function sendWpMsg(serviceUrl: string, phone: string, message: string) {
  await fetch(`${serviceUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, message }),
    signal: AbortSignal.timeout(15000),
  });
}

async function sendWpDocument(serviceUrl: string, phone: string, docBase64: string, filename: string, caption: string) {
  await fetch(`${serviceUrl}/send-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: phone,
      document: docBase64,
      mimetype: "application/pdf",
      filename,
      caption,
    }),
    signal: AbortSignal.timeout(30000),
  });
}

async function sendWpImage(serviceUrl: string, phone: string, imgBase64: string, mimetype: string, caption: string) {
  await fetch(`${serviceUrl}/send-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, image: imgBase64, mimetype, caption }),
    signal: AbortSignal.timeout(30000),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://foxvize.com";

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase yapilandirmasi eksik" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: talepler, error } = await supabase
      .from("randevu_talepleri")
      .select("id, dosya_adi, iletisim, ulkeler, randevu_tarihi, randevu_ulke, evrak_hatirlatma_gonderildi")
      .eq("arsivlendi", false)
      .not("randevu_tarihi", "is", null);

    if (error || !talepler) {
      return NextResponse.json({ error: "Veri alinamadi", detail: error?.message }, { status: 500 });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let sent = 0;

    for (const talep of talepler) {
      if (talep.evrak_hatirlatma_gonderildi) continue;

      const randevuTarihi = new Date(talep.randevu_tarihi);
      randevuTarihi.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((randevuTarihi.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays > 20 || diffDays < 0) continue;

      const musteriTel = (talep.iletisim || "").replace(/\D/g, "");
      if (!musteriTel || musteriTel.length < 10) continue;
      const musteriPhone = musteriTel.startsWith("90") ? musteriTel : `90${musteriTel.replace(/^0/, "")}`;

      const randevuUlke = talep.randevu_ulke || (talep.ulkeler?.length === 1 ? talep.ulkeler[0] : null);
      const ulkeler: string[] = randevuUlke ? [randevuUlke] : (talep.ulkeler || []);

      const evrakSonTarih = new Date(randevuTarihi);
      evrakSonTarih.setDate(evrakSonTarih.getDate() - 15);

      const mesaj =
        `Sayın Müşterimiz,\n\n` +
        `*${talep.dosya_adi}* dosyanız için *${formatTrDate(randevuTarihi)}* tarihinde randevunuz bulunmaktadır.\n\n` +
        `Evraklarınızı en geç *${formatTrDate(evrakSonTarih)}* tarihine kadar hazırlamanız gerekmektedir.\n\n` +
        `Gerekli evrak listesi aşağıda gönderilecektir.\n\n` +
        `Fox Turizm Randevu Takip Sistemi`;

      try {
        await sendWpMsg(serviceUrl, musteriPhone, mesaj);
        await new Promise(r => setTimeout(r, 2000));

        for (const ulke of ulkeler) {
          const pdfFile = ULKE_PDF_MAP[ulke];
          if (!pdfFile) continue;

          try {
            const pdfUrl = `${siteUrl}/evrak-pdfs/${pdfFile}`;
            const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(15000) });
            if (pdfRes.ok) {
              const pdfBuffer = await pdfRes.arrayBuffer();
              const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
              await sendWpDocument(
                serviceUrl,
                musteriPhone,
                pdfBase64,
                `Gerekli_Evraklar_${ulke}.pdf`,
                `${ulke} - Gerekli Evrak Listesi`
              );
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch {
            // PDF gonderilemezse devam et
          }
        }

        try {
          const adresUrl = `${siteUrl}/fox-adres.png`;
          const adresRes = await fetch(adresUrl, { signal: AbortSignal.timeout(15000) });
          if (adresRes.ok) {
            const adresBuffer = await adresRes.arrayBuffer();
            const adresBase64 = Buffer.from(adresBuffer).toString("base64");
            await sendWpImage(serviceUrl, musteriPhone, adresBase64, "image/png", "Adresimiz");
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch {
          // Adres gorseli gonderilemezse devam et
        }

        const iletisimMesaj =
          `*İletişim Bilgilerimiz:*\n\n` +
          `Ercan Bey: 0505 562 33 01\n` +
          `Bahar Hanım: 0505 562 32 79\n\n` +
          `Herhangi bir sorunuz olursa yukarıdaki numaralardan bize ulaşabilirsiniz.\n\n` +
          `Fox Turizm`;

        await sendWpMsg(serviceUrl, musteriPhone, iletisimMesaj);

        await supabase
          .from("randevu_talepleri")
          .update({ evrak_hatirlatma_gonderildi: true })
          .eq("id", talep.id);

        sent++;
        await new Promise(r => setTimeout(r, 3000));
      } catch {
        // Mesaj gonderilemezse sonraki talepe gec
      }
    }

    return NextResponse.json({ success: true, sent, total: talepler.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
