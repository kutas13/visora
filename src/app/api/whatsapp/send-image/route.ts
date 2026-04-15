import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { phone, image, mimetype, caption } = await request.json();

    if (!phone || !image) {
      return NextResponse.json({ error: "phone ve image zorunlu" }, { status: 400 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

    try {
      const statusRes = await fetch(`${serviceUrl}/status`, { signal: AbortSignal.timeout(5000) });
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusData.connected) {
        return NextResponse.json({ error: "WhatsApp bağlı değil" }, { status: 503 });
      }
    } catch {
      return NextResponse.json({ error: "WhatsApp servisi erişilemedi" }, { status: 503 });
    }

    let rawBase64: string;
    let mtype: string;

    if (image.startsWith("http://") || image.startsWith("https://")) {
      // Storage URL → fetch and convert to base64
      const imgRes = await fetch(image, { signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) {
        return NextResponse.json({ error: "Görsel URL'den indirilemedi" }, { status: 500 });
      }
      const contentType = imgRes.headers.get("content-type") || mimetype || "image/jpeg";
      const arrayBuffer = await imgRes.arrayBuffer();
      rawBase64 = Buffer.from(arrayBuffer).toString("base64");
      mtype = contentType;
    } else if (image.startsWith("data:")) {
      // data URL → extract base64 + mimetype
      const match = image.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        mtype = match[1];
        rawBase64 = match[2];
      } else {
        return NextResponse.json({ error: "Geçersiz data URL" }, { status: 400 });
      }
    } else {
      // Raw base64
      rawBase64 = image;
      mtype = mimetype || "image/jpeg";
    }

    const isPdf = mtype === "application/pdf";

    if (isPdf) {
      const res = await fetch(`${serviceUrl}/send-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          document: rawBase64,
          mimetype: mtype,
          filename: caption ? `${caption}.pdf` : "Randevu_Mektubu.pdf",
          caption: caption || "",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: data.error || "PDF gönderilemedi" }, { status: 500 });
      }
    } else {
      const res = await fetch(`${serviceUrl}/send-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, image: rawBase64, mimetype: mtype, caption: caption || "" }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: data.error || "Görsel gönderilemedi" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-image] Hata:", err);
    return NextResponse.json({ error: err?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
