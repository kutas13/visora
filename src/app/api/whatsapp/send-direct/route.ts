import { NextRequest, NextResponse } from "next/server";
import { isWhatsappEnabled, WHATSAPP_DISABLED_MESSAGE } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isWhatsappEnabled()) {
    return NextResponse.json(
      { ok: false, disabled: true, error: WHATSAPP_DISABLED_MESSAGE },
      { status: 410 }
    );
  }

  try {
    const { phone, message } = await request.json();

    console.log("[send-direct] İstek alındı:", { phone, messageLen: message?.length });

    if (!phone || !message) {
      return NextResponse.json({ error: "phone ve message zorunlu" }, { status: 400 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";
    console.log("[send-direct] Service URL:", serviceUrl);

    let statusData: any = {};
    try {
      const statusRes = await fetch(`${serviceUrl}/status`, {
        signal: AbortSignal.timeout(5000),
      });
      statusData = await statusRes.json().catch(() => ({}));
      console.log("[send-direct] Status:", statusData);
    } catch (statusErr) {
      console.error("[send-direct] Status kontrolü başarısız:", statusErr);
      return NextResponse.json({ error: "WhatsApp servisi erişilemedi" }, { status: 503 });
    }

    if (!statusData.connected) {
      return NextResponse.json({ error: "WhatsApp bağlı değil", status: statusData }, { status: 503 });
    }

    const wpRes = await fetch(`${serviceUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message }),
      signal: AbortSignal.timeout(15000),
    });

    const wpData = await wpRes.json().catch(() => ({}));
    console.log("[send-direct] Gönderim sonucu:", wpRes.status, wpData);

    if (!wpRes.ok) {
      return NextResponse.json({ error: wpData.error || "Mesaj gönderilemedi", details: wpData }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-direct] Hata:", err);
    return NextResponse.json({ error: err?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
