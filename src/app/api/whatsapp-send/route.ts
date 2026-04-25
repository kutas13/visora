import { NextRequest, NextResponse } from "next/server";
import { isWhatsappEnabled, WHATSAPP_DISABLED_MESSAGE } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

/**
 * WhatsApp mesaj gönderme - Baileys servisi üzerinden.
 * Visora'da kapatildi: dis numaralara mesaj gitmesi tamamen devre disi.
 */
export async function POST(request: NextRequest) {
  if (!isWhatsappEnabled()) {
    return NextResponse.json(
      { ok: false, disabled: true, error: WHATSAPP_DISABLED_MESSAGE },
      { status: 410 }
    );
  }

  try {
    const body = await request.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json({ error: "to ve message zorunlu" }, { status: 400 });
    }

    // Baileys servisinin adresi
    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

    // Önce bağlantı durumunu kontrol et
    try {
      const statusRes = await fetch(`${serviceUrl}/status`, {
        signal: AbortSignal.timeout(3000),
      });
      const statusData = await statusRes.json();

      if (!statusData.connected) {
        return NextResponse.json(
          {
            error: "WhatsApp servisi ba\u011fl\u0131 de\u011fil. L\u00fctfen QR kodu taray\u0131n.",
            hint: "whatsapp-service klas\u00f6r\u00fcnde 'node index.js' \u00e7al\u0131\u015ft\u0131r\u0131n ve QR kodu taray\u0131n.",
          },
          { status: 503 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: "WhatsApp servisi \u00e7al\u0131\u015fm\u0131yor.",
          hint: "whatsapp-service klas\u00f6r\u00fcnde 'node index.js' ile ba\u015flat\u0131n.",
        },
        { status: 503 }
      );
    }

    // Mesajı Baileys servisine gönder
    const res = await fetch(`${serviceUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Baileys servis hatas\u0131:", JSON.stringify(data));
      return NextResponse.json(
        { error: data?.error || "WhatsApp mesaj\u0131 g\u00f6nderilemedi", details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.messageId,
      to: data?.to,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "WhatsApp hatasi";
    console.error("WhatsApp gonderim hatasi:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
