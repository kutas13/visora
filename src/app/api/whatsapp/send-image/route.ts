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

    // base64 data URL'den raw base64'e çevir
    let rawBase64 = image;
    let mtype = mimetype || "image/jpeg";
    const match = image.match(/^data:(.+);base64,(.+)$/);
    if (match) {
      mtype = match[1];
      rawBase64 = match[2];
    }

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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-image] Hata:", err);
    return NextResponse.json({ error: err?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
