import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role client (RLS bypass)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tarih yardımcı fonksiyonları
function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(date1: Date, date2: Date): number {
  const d1 = new Date(date1); d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2); d2.setHours(0, 0, 0, 0);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isChinaCountry(ulke: string | null | undefined): boolean {
  if (!ulke) return false;
  const normalized = String(ulke)
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();
  return normalized === "cin" || normalized === "china";
}

// Bildirim oluştur (unique_key ile idempotent)
async function createNotification(data: {
  user_id: string;
  file_id?: string;
  kind: string;
  title: string;
  body: string;
  unique_key: string;
}) {
  try {
    const { error } = await supabase.from("notifications").insert({
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
    });
    
    if (error && !error.message.includes("duplicate")) {
      console.error("Bildirim oluşturma hatası:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Bildirim exception:", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Secret kontrolü
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const today = getToday();
  const todayStr = today.toISOString().slice(0, 10);
  let createdCount = 0;

  try {
    // Cok-firma: her sirketin kendi admin'i (Genel Mudur) farkli.
    // Tum admin profillerini cek, organization_id -> adminId map'i kur.
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("role", "admin");

    const adminByOrg = new Map<string, string>();
    for (const a of (adminProfiles as { id: string; organization_id: string | null }[] | null) || []) {
      if (a.organization_id) adminByOrg.set(a.organization_id, a.id);
    }

    // Tum aktif dosyalari getir (assignee + organization_id ile)
    const { data: files } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(id, name, organization_id)");

    if (!files) {
      return NextResponse.json({ success: true, created: 0, message: "Dosya bulunamadı" });
    }

    for (const file of files) {
      const staffId = file.assigned_user_id;
      // Bu dosyanin sirketinin Genel Muduru'nu (admin) bul.
      const fileOrgId =
        (file as { organization_id?: string | null }).organization_id ||
        (file as { profiles?: { organization_id?: string | null } | null }).profiles?.organization_id ||
        null;
      const adminId = fileOrgId ? adminByOrg.get(fileOrgId) || null : null;

      // ==========================================
      // KURAL 1: Randevuya 15 gün kala
      // ==========================================
      if (file.islem_tipi === "randevulu" && file.randevu_tarihi) {
        const randevuDate = new Date(file.randevu_tarihi);
        const daysUntil = diffDays(today, randevuDate);

        if (daysUntil === 15) {
          const uniqueKey = `file:${file.id}:r15:${todayStr}`;
          
          // Personele bildirim
          if (await createNotification({
            user_id: staffId,
            file_id: file.id,
            kind: "randevu_15",
            title: "Randevu Yaklaşıyor (15 Gün)",
            body: `${file.musteri_ad} (${file.hedef_ulke}) randevusuna 15 gün kaldı.`,
            unique_key: uniqueKey,
          })) createdCount++;

          // Admin'e bildirim
          if (adminId && adminId !== staffId) {
            if (await createNotification({
              user_id: adminId,
              file_id: file.id,
              kind: "randevu_15",
              title: "Randevu Yaklaşıyor (15 Gün)",
              body: `${file.musteri_ad} (${file.hedef_ulke}) randevusuna 15 gün kaldı.`,
              unique_key: `${uniqueKey}:admin`,
            })) createdCount++;
          }

          // KURAL 3: Evrak gelmedi uyarısı (15 gün kala)
          if (file.evrak_durumu === "gelmedi") {
            const evrakKey = `file:${file.id}:evrak_gelmedi:${todayStr}`;
            
            if (await createNotification({
              user_id: staffId,
              file_id: file.id,
              kind: "evrak_gelmedi",
              title: "Evraklar Hâlâ Gelmedi",
              body: `${file.musteri_ad} dosyasında evraklar hâlâ gelmedi. Randevuya 15 gün kaldı.`,
              unique_key: evrakKey,
            })) createdCount++;

            if (adminId && adminId !== staffId) {
              if (await createNotification({
                user_id: adminId,
                file_id: file.id,
                kind: "evrak_gelmedi",
                title: "Evraklar Hâlâ Gelmedi",
                body: `${file.musteri_ad} dosyasında evraklar hâlâ gelmedi. Randevuya 15 gün kaldı.`,
                unique_key: `${evrakKey}:admin`,
              })) createdCount++;
            }
          }
        }

        // ==========================================
        // KURAL 2: Randevuya 2 gün kala
        // ==========================================
        if (daysUntil === 2) {
          const uniqueKey = `file:${file.id}:r2:${todayStr}`;
          
          if (await createNotification({
            user_id: staffId,
            file_id: file.id,
            kind: "randevu_2",
            title: "Randevu Yaklaşıyor (2 Gün)",
            body: `${file.musteri_ad} (${file.hedef_ulke}) randevusuna 2 gün kaldı.`,
            unique_key: uniqueKey,
          })) createdCount++;

          if (adminId && adminId !== staffId) {
            if (await createNotification({
              user_id: adminId,
              file_id: file.id,
              kind: "randevu_2",
              title: "Randevu Yaklaşıyor (2 Gün)",
              body: `${file.musteri_ad} (${file.hedef_ulke}) randevusuna 2 gün kaldı.`,
              unique_key: `${uniqueKey}:admin`,
            })) createdCount++;
          }
        }
      }

      // ==========================================
      // KURAL 4: Evrak eksik 5 gün kuralı
      // ==========================================
      if (file.evrak_eksik_mi === true && file.eksik_kayit_tarihi) {
        const eksikDate = new Date(file.eksik_kayit_tarihi);
        const daysPassed = diffDays(eksikDate, today);

        if (daysPassed === 5) {
          const uniqueKey = `file:${file.id}:eksik5:${todayStr}`;
          
          if (await createNotification({
            user_id: staffId,
            file_id: file.id,
            kind: "evrak_eksik_5",
            title: "Eksik Evrak 5 Gündür Tamamlanmadı",
            body: `${file.musteri_ad} dosyasında eksikler 5 gündür tamamlanmadı.`,
            unique_key: uniqueKey,
          })) createdCount++;

          if (adminId && adminId !== staffId) {
            if (await createNotification({
              user_id: adminId,
              file_id: file.id,
              kind: "evrak_eksik_5",
              title: "Eksik Evrak 5 Gündür Tamamlanmadı",
              body: `${file.musteri_ad} dosyasında eksikler 5 gündür tamamlanmadı.`,
              unique_key: `${uniqueKey}:admin`,
            })) createdCount++;
          }
        }
      }

      // ==========================================
      // KURAL 5: Vize bitiş hatırlatmaları (60, 50, 40, 30, 20, 10 gün)
      // Çin dosyaları için bu bildirim gönderilmez
      // ==========================================
      if (file.sonuc === "vize_onay" && file.vize_bitis_tarihi && !isChinaCountry(file.hedef_ulke)) {
        const vizeBitisDate = new Date(file.vize_bitis_tarihi);
        const daysRemaining = diffDays(today, vizeBitisDate);
        const thresholds = [60, 50, 40, 30, 20, 10];

        if (thresholds.includes(daysRemaining)) {
          const uniqueKey = `file:${file.id}:vizebitis:${daysRemaining}`;
          
          if (await createNotification({
            user_id: staffId,
            file_id: file.id,
            kind: "vize_bitis",
            title: "Vize Bitiş Hatırlatması",
            body: `${file.musteri_ad} (${file.hedef_ulke}) vizesinin bitişine ${daysRemaining} gün kaldı. Bitiş: ${formatDate(file.vize_bitis_tarihi)}`,
            unique_key: uniqueKey,
          })) createdCount++;

          if (adminId && adminId !== staffId) {
            if (await createNotification({
              user_id: adminId,
              file_id: file.id,
              kind: "vize_bitis",
              title: "Vize Bitiş Hatırlatması",
              body: `${file.musteri_ad} (${file.hedef_ulke}) vizesinin bitişine ${daysRemaining} gün kaldı. Bitiş: ${formatDate(file.vize_bitis_tarihi)}`,
              unique_key: `${uniqueKey}:admin`,
            })) createdCount++;
          }
        }
      }
    }

    // Activity log — actor olarak ilk dosyanin assignee'sini kullan
    // (cok-firma cron'u tek bir admin'e baglanmamali).
    if (createdCount > 0) {
      await supabase.from("activity_logs").insert({
        type: "notification_created",
        message: `Otomatik bildirim sistemi ${createdCount} bildirim oluşturdu`,
        actor_id: files[0]?.assigned_user_id,
      });
    }

    return NextResponse.json({
      success: true,
      created: createdCount,
      date: todayStr,
      message: `${createdCount} bildirim oluşturuldu`,
    });

  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// GET isteği için de çalış (test amaçlı)
export async function GET(request: NextRequest) {
  return POST(request);
}
