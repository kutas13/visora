import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: "phone ve message zorunlu" }, { status: 400 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

    const statusRes = await fetch(`${serviceUrl}/status`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!statusRes) {
      return NextResponse.json({ error: "WhatsApp servisi erişilemedi" }, { status: 503 });
    }

    const statusData = await statusRes.json().catch(() => ({}));
    if (!statusData.connected) {
      return NextResponse.json({ error: "WhatsApp bağlı değil" }, { status: 503 });
    }

    const wpRes = await fetch(`${serviceUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });

    const wpData = await wpRes.json().catch(() => ({}));

    if (!wpRes.ok) {
      return NextResponse.json({ error: wpData.error || "Mesaj gönderilemedi" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("WhatsApp send-direct hatası:", err);
    return NextResponse.json({ error: err?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
