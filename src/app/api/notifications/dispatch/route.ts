import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveOrgContextFromUser } from "@/lib/mailerServer";
import {
  sendTahsilatEmail,
  sendDosyaOlusturulduEmail,
  sendRandevuTalebiEmail,
  sendRandevuAlindiEmail,
} from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tek bir endpoint uzerinden tum bildirim mailleri.
 * Body:
 *   { kind: "tahsilat" | "dosya" | "randevu_talebi" | "randevu_alindi", payload: {...} }
 *
 * Auth: oturumdaki kullanici. Onun organization_id'sinden GM email cozulur.
 * GM email yoksa atlar (200 ile skipped: "no_gm_email").
 */
export async function POST(request: NextRequest) {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Yetkisiz." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind = body?.kind as string | undefined;
  const payload = body?.payload || {};

  if (!kind) {
    return NextResponse.json({ ok: false, error: "kind gerekli." }, { status: 400 });
  }

  const ctx = await resolveOrgContextFromUser(user.id);
  if (!ctx) {
    return NextResponse.json({
      ok: true,
      skipped: "no_org_context",
      message: "GM email cozulemedi, mail atlandi.",
    });
  }

  // Aktor adi: oturumdaki kullanicinin profil ismi (mail icinde gosterim icin).
  const { data: actorProfile } = await sb
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();
  const actorName =
    (actorProfile as any)?.name ||
    (user.user_metadata as any)?.name ||
    "Bir kullanıcı";
  const actorRole = (actorProfile as any)?.role || "staff";
  const actorLabelSuffix = actorRole === "admin" ? " (Genel Müdür)" : " (personel)";

  try {
    switch (kind) {
      case "tahsilat": {
        const r = await sendTahsilatEmail({
          gmEmail: ctx.gmEmail,
          actorName: `${actorName}${actorLabelSuffix}`,
          musteriAd: payload.musteriAd || "—",
          hedefUlke: payload.hedefUlke || null,
          tutar: Number(payload.tutar) || 0,
          currency: payload.currency || "TL",
          yontem: payload.yontem || "nakit",
          hesapSahibi: payload.hesapSahibi || null,
          tlKarsilik:
            typeof payload.tlKarsilik === "number" ? payload.tlKarsilik : null,
          notlar: payload.notlar || null,
        });
        return NextResponse.json({ ok: true, kind, result: r });
      }
      case "dosya": {
        const r = await sendDosyaOlusturulduEmail({
          gmEmail: ctx.gmEmail,
          actorName: `${actorName}${actorLabelSuffix}`,
          musteriAd: payload.musteriAd || "—",
          hedefUlke: payload.hedefUlke || "—",
          ucret: Number(payload.ucret) || 0,
          currency: payload.currency || "TL",
          odemePlani: payload.odemePlani || "cari",
          pesinTahsilat: payload.pesinTahsilat || undefined,
          onOdeme: payload.onOdeme || null,
          notlar: payload.notlar || null,
        });
        return NextResponse.json({ ok: true, kind, result: r });
      }
      case "randevu_talebi": {
        const r = await sendRandevuTalebiEmail({
          gmEmail: ctx.gmEmail,
          actorName: `${actorName}${actorLabelSuffix}`,
          dosyaAdi: payload.dosyaAdi || "—",
          ulkeler: Array.isArray(payload.ulkeler) ? payload.ulkeler : [],
          vizeTipi: payload.vizeTipi || "—",
          iletisim: payload.iletisim || null,
          notlar: payload.notlar || null,
        });
        return NextResponse.json({ ok: true, kind, result: r });
      }
      case "randevu_alindi": {
        const r = await sendRandevuAlindiEmail({
          gmEmail: ctx.gmEmail,
          actorName: `${actorName}${actorLabelSuffix}`,
          dosyaAdi: payload.dosyaAdi || "—",
          ulkeler: Array.isArray(payload.ulkeler) ? payload.ulkeler : [],
          vizeTipi: payload.vizeTipi || "—",
          randevuTarihi: payload.randevuTarihi || new Date().toISOString(),
          olusturanAd: payload.olusturanAd || null,
        });
        return NextResponse.json({ ok: true, kind, result: r });
      }
      default:
        return NextResponse.json(
          { ok: false, error: `Bilinmeyen kind: ${kind}` },
          { status: 400 }
        );
    }
  } catch (e: any) {
    // Mail gondermek istemcinin iz dusumunu bozmamali; sadece log + 200.
    console.error("[notifications/dispatch] error:", e);
    return NextResponse.json({
      ok: false,
      kind,
      error: e?.message || String(e),
    });
  }
}
