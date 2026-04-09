import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { phone, imageBase64, caption } = await request.json();

    if (!phone || !imageBase64) {
      return NextResponse.json({ error: "phone ve imageBase64 zorunlu" }, { status: 400 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

    let statusData: any = {};
    try {
      const statusRes = await fetch(`${serviceUrl}/status`, {
        signal: AbortSignal.timeout(5000),
      });
      statusData = await statusRes.json().catch(() => ({}));
    } catch {
      return NextResponse.json({ error: "WhatsApp servisi erişilemedi" }, { status: 503 });
    }

    if (!statusData.connected) {
      return NextResponse.json({ error: "WhatsApp bağlı değil" }, { status: 503 });
    }

    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);/);
    const mimetype = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const wpRes = await fetch(`${serviceUrl}/send-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        image: base64Data,
        mimetype,
        caption: caption || "",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const wpData = await wpRes.json().catch(() => ({}));

    if (!wpRes.ok) {
      return NextResponse.json({ error: wpData.error || "Görsel gönderilemedi", details: wpData }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-image] Hata:", err);
    return NextResponse.json({ error: err?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
