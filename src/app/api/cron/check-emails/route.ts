import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseIdataEmail, isIdataAssignmentEmail, getIdataEmailType } from "@/lib/idata-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 saniye timeout

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Email hesaplari ve sifre mapping (Davut/info hesabi haric)
const EMAIL_ACCOUNTS = [
  { email: "yusuf@foxturizm.com", passKey: "SMTP_PASS_YUSUF" },
  { email: "vize@foxturizm.com", passKey: "SMTP_PASS_BAHAR" },
  { email: "ercan@foxturizm.com", passKey: "SMTP_PASS_ERCAN" },
];

// Ayni PNR icin 3 gun icinde gelen mailleri yoksay
const PNR_COOLDOWN_DAYS = 3;

interface EmailMessage {
  uid: string;
  from: string;
  subject: string;
  body: string;
}

/**
 * Tek bir email hesabini IMAP ile kontrol eder
 */
async function checkEmailAccount(
  email: string,
  password: string
): Promise<EmailMessage[]> {
  // imapflow'u dinamik import et (Node.js modulu)
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: "imap.yandex.com",
    port: 993,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
    logger: false,
  });

  const messages: EmailMessage[] = [];

  try {
    await client.connect();

    // INBOX'i ac
    const lock = await client.getMailboxLock("INBOX");

    try {
      // noreply@idata.com.tr'den gelen son 2 günün maillerini ara  
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const searchResults = await client.search({
        since: twoDaysAgo,
        from: "idata.com.tr",
      });

      if (!searchResults || searchResults.length === 0) {
        return messages;
      }

      // Her mesaji oku
      for (const uid of searchResults) {
        try {
          const msg = await client.fetchOne(String(uid), {
            uid: true,
            envelope: true,
            source: true,
          });

          if (!msg) continue;

          const envelope = msg.envelope;
          const from =
            envelope?.from?.[0]?.address || "";
          const subject = envelope?.subject || "";

          // iDATA randevu atamasi mi kontrol et
          if (!isIdataAssignmentEmail(from, subject)) continue;

          // Email body'sini al
          let body = "";
          if (msg.source) {
            const sourceStr = msg.source.toString();
            // Basit body extraction - Content sonrasini al
            const bodyMatch = sourceStr.match(
              /Content-Type:\s*text\/(?:html|plain)[^]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i
            );
            if (bodyMatch) {
              body = bodyMatch[1];
            } else {
              // Tum source'u kullan (fallback)
              body = sourceStr;
            }

            // Base64 decode denemesi
            if (body.match(/^[A-Za-z0-9+/\r\n]+=*$/)) {
              try {
                body = Buffer.from(body.replace(/\r?\n/g, ""), "base64").toString("utf-8");
              } catch {
                // decode basarisiz, olduğu gibi birak
              }
            }

            // Quoted-printable decode
            body = body.replace(/=\r?\n/g, "");
            body = body.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          }

          messages.push({
            uid: String(msg.uid || uid),
            from,
            subject,
            body,
          });

          // Maili okundu olarak isaretle
          await client.messageFlagsAdd(String(uid), ["\\Seen"]);
        } catch (msgErr) {
          console.error(`Mesaj okuma hatasi (UID ${uid}):`, msgErr);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`IMAP baglanti hatasi (${email}):`, err);
  } finally {
    try {
      await client.logout();
    } catch {
      // logout hatasi yoksay
    }
  }

  return messages;
}

/**
 * WhatsApp mesaj gonder
 */
async function sendWhatsApp(
  to: string,
  message: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function processEmails(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const whatsappTo = process.env.WHATSAPP_NOTIFY_NUMBER;

  let totalNew = 0;
  let totalChecked = 0;
  const errors: string[] = [];

  // Her email hesabini kontrol et
  const accountResults = await Promise.allSettled(
    EMAIL_ACCOUNTS.map(async (account) => {
      const password = process.env[account.passKey];
      if (!password) {
        errors.push(`${account.email}: Sifre bulunamadi (${account.passKey})`);
        return { email: account.email, newCount: 0, checked: 0 };
      }

      try {
        const messages = await checkEmailAccount(account.email, password);
        let newCount = 0;

        for (const msg of messages) {
          totalChecked++;

          // Email'i parse et
          const parsed = parseIdataEmail(msg.body, msg.subject);
          if (!parsed) {
            console.warn(`Parse edilemedi: ${msg.subject}`);
            continue;
          }

          // Email tipini belirle: "atama" mi "randevu" mu?
          const emailType = getIdataEmailType(msg.subject, msg.body);
          
          if (emailType === "randevu") {
            // Randevu maili: mevcut atama kaydını "randevu geldi" durumuna güncelle
            const { data: existingAssignment } = await supabase
              .from("idata_assignments")
              .select("id, durum")
              .eq("pnr", parsed.pnr)
              .eq("musteri_ad", parsed.musteriAd)
              .order("created_at", { ascending: false })
              .limit(1);

            if (existingAssignment && existingAssignment.length > 0) {
              // Mevcut kaydı güncelle
              await supabase
                .from("idata_assignments")
                .update({ 
                  durum: "randevu_geldi", // Yeni durum
                  randevu_baslangic: parsed.randevuBaslangic,
                  randevu_bitis: parsed.randevuBitis,
                  son_kayit_tarihi: parsed.sonKayitTarihi,
                })
                .eq("id", existingAssignment[0].id);

              console.log(`✅ Randevu güncellendi: ${parsed.musteriAd} - ${parsed.pnr}`);
              newCount++;
              continue;
            } else {
              // Eşleşme yok, yeni kayıt oluştur (randevu geldi durumunda)
              console.log(`🆕 Yeni randevu kaydı: ${parsed.musteriAd} - ${parsed.pnr}`);
            }
          } else {
            // Atama maili: PNR deduplication kontrol et
            const cooldownDate = new Date();
            cooldownDate.setDate(cooldownDate.getDate() - PNR_COOLDOWN_DAYS);
            const { data: existingPnr } = await supabase
              .from("idata_assignments")
              .select("id")
              .eq("pnr", parsed.pnr)
              .gte("created_at", cooldownDate.toISOString())
              .limit(1);

            if (existingPnr && existingPnr.length > 0) {
              // 3 gün içinde aynı PNR var, yoksay
              continue;
            }
          }

          // Supabase'e kaydet (duplicate check otomatik - unique constraint)
          const { data, error } = await supabase
            .from("idata_assignments")
            .upsert(
              {
                musteri_ad: parsed.musteriAd,
                pnr: parsed.pnr,
                ulke_amac: parsed.ulkeAmac || null,
                ofis: parsed.ofis || null,
                randevu_baslangic: parsed.randevuBaslangic,
                randevu_bitis: parsed.randevuBitis,
                son_kayit_tarihi: parsed.sonKayitTarihi,
                email_hesabi: account.email,
                email_uid: `${account.email}:${msg.uid}`,
                durum: "yeni",
                whatsapp_bildirim: false,
              },
              {
                onConflict: "email_hesabi,email_uid",
                ignoreDuplicates: true,
              }
            )
            .select()
            .single();

          if (error) {
            // Duplicate hata degil ise logla
            if (!error.message?.includes("duplicate")) {
              console.error("Supabase kayit hatasi:", error);
            }
            continue;
          }

          if (data) {
            newCount++;
            totalNew++;

            // WhatsApp bildirim gonder (admin'e)
            if (whatsappTo) {
              const whatsappMsg =
                `📬 *iDATA Randevu Ataması (Yeni)*\n\n` +
                `👤 Müşteri: *${parsed.musteriAd}*\n` +
                `🔖 PNR: *${parsed.pnr}*\n` +
                `🌍 Ülke: *${parsed.ulkeAmac}*\n` +
                `🏢 Ofis: *${parsed.ofis}*\n` +
                (parsed.randevuBaslangic && parsed.randevuBitis
                  ? `📅 Randevu Aralığı: *${formatDateTr(parsed.randevuBaslangic)} - ${formatDateTr(parsed.randevuBitis)}*\n`
                  : "") +
                (parsed.sonKayitTarihi
                  ? `⏰ Son Kayıt: *${formatDateTimeTr(parsed.sonKayitTarihi)}*\n`
                  : "") +
                `📧 Hesap: *${account.email}*\n\n` +
                `_Fox Turizm Vize Yönetim Sistemi_`;

              const sent = await sendWhatsApp(whatsappTo, whatsappMsg, baseUrl);

              if (sent) {
                // whatsapp_bildirim = true yap
                await supabase
                  .from("idata_assignments")
                  .update({ whatsapp_bildirim: true })
                  .eq("id", data.id);
              }
            }
          }
        }

        return { email: account.email, newCount, checked: messages.length };
      } catch (err: any) {
        const errMsg = `${account.email}: ${err?.message || "Bilinmeyen hata"}`;
        errors.push(errMsg);
        return { email: account.email, newCount: 0, checked: 0 };
      }
    })
  );

  // Sonuclari topla
  const results = accountResults.map((r) =>
    r.status === "fulfilled" ? r.value : { email: "?", newCount: 0, checked: 0 }
  );

  return NextResponse.json({
    success: true,
    totalNew,
    totalChecked,
    accounts: results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}

function formatDateTr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTimeTr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// POST: Cron secret veya authenticated user ile calisir
export async function POST(request: NextRequest) {
  // Cron secret kontrolu
  const secret =
    request.headers.get("x-cron-secret") ||
    request.nextUrl.searchParams.get("secret");

  // Ya cron secret dogru olmali ya da authenticated kullanici olmali
  if (secret === process.env.CRON_SECRET) {
    return processEmails(request);
  }

  // Authenticated kullanici kontrolu (manuel buton icin)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return processEmails(request);
  }

  // Cookie-based auth kontrolu
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader && cookieHeader.includes("sb-")) {
    return processEmails(request);
  }

  return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
}

// GET: Test ve cron icin
export async function GET(request: NextRequest) {
  return POST(request);
}
