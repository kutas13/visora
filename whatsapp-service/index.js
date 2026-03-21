/**
 * Fox Turizm - WhatsApp Bildirim Servisi (Baileys)
 *
 * - Bilgisayar açıldığında otomatik başlar
 * - WhatsApp'a bağlanır (ilk seferde QR kod taratırsınız, sonra otomatik)
 * - Bağlandığında randevuları kontrol eder ve 3 gün kala hatırlatma gönderir
 * - Her 4 saatte bir tekrar kontrol eder
 * - Aynı gün aynı dosya için tekrar mesaj göndermez
 *
 * Kullanım: node index.js
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const { createClient } = require("@supabase/supabase-js");
const qrcode = require("qrcode-terminal");
const http = require("http");
const path = require("path");
const fs = require("fs");
const pino = require("pino");

// ─── .env.local dosyasını oku ───────────────────────────
// Üst klasördeki .env.local'dan Supabase bilgilerini alır
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  });
  console.log("  .env.local yuklendi.\n");
} else {
  console.log("  UYARI: .env.local bulunamadi! Supabase bilgileri eksik olabilir.\n");
}

// ─── Ayarlar ────────────────────────────────────────────
const PORT = process.env.WA_PORT || 3001;
const AUTH_DIR = path.join(__dirname, "auth_info");
const SENT_LOG = path.join(__dirname, "sent_today.json");
const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 saat (ms)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOTIFY_NUMBER = process.env.WHATSAPP_NOTIFY_NUMBER;
// ────────────────────────────────────────────────────────

const logger = pino({ level: "warn" });

let sock = null;
let isConnected = false;
let qrCode = null;
let connectionAttempts = 0;
const MAX_RECONNECT = 5;
let checkInterval = null;

// Supabase client
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("  Supabase baglantisi hazir.");
} else {
  console.log("  UYARI: Supabase ayarlari eksik! Randevu kontrolu calismayacak.");
}

// ─── Bugün gönderilenleri takip et (tekrar göndermeyi önle) ─
function loadSentToday() {
  try {
    if (fs.existsSync(SENT_LOG)) {
      const data = JSON.parse(fs.readFileSync(SENT_LOG, "utf-8"));
      const today = new Date().toISOString().slice(0, 10);
      // Farklı günse sıfırla
      if (data.date !== today) {
        return { date: today, ids: [] };
      }
      return data;
    }
  } catch {}
  return { date: new Date().toISOString().slice(0, 10), ids: [] };
}

function saveSentToday(data) {
  try {
    fs.writeFileSync(SENT_LOG, JSON.stringify(data, null, 2));
  } catch {}
}

function markAsSent(fileId) {
  const data = loadSentToday();
  if (!data.ids.includes(fileId)) {
    data.ids.push(fileId);
    saveSentToday(data);
  }
}

function wasAlreadySent(fileId) {
  const data = loadSentToday();
  return data.ids.includes(fileId);
}

// ─── Tarih formatla ─────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Randevu kontrol ve hatırlatma gönder ───────────────
async function checkAppointments() {
  if (!isConnected || !sock) {
    console.log("  WhatsApp bagli degil, randevu kontrolu atlanıyor.");
    return;
  }
  if (!supabase) {
    console.log("  Supabase ayarlari eksik, randevu kontrolu atlanıyor.");
    return;
  }
  if (!NOTIFY_NUMBER) {
    console.log("  WHATSAPP_NOTIFY_NUMBER tanimli degil, randevu kontrolu atlanıyor.");
    return;
  }

  console.log(`\n🔍 Randevu kontrolu yapiliyor... (${new Date().toLocaleString("tr-TR")})`);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Yarin (1 gun) ile 3 gun sonrasi arasindaki randevulari kontrol et
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const limit = new Date(today);
    limit.setDate(today.getDate() + 4); // 3 gun sonrasinin sonu (dahil)

    // Randevusu olan dosyaları getir
    const { data: files, error } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .not("randevu_tarihi", "is", null)
      .is("sonuc", null);

    if (error) {
      console.error("  Supabase sorgu hatasi:", error.message);
      return;
    }

    if (!files || files.length === 0) {
      console.log("  Randevusu olan dosya bulunamadi.");
      return;
    }

    // 1-3 gun icinde randevusu olanlari filtrele
    const upcomingFiles = files.filter((f) => {
      if (!f.randevu_tarihi) return false;
      const rd = new Date(f.randevu_tarihi);
      rd.setHours(0, 0, 0, 0);
      return rd >= tomorrow && rd < limit;
    });

    if (upcomingFiles.length === 0) {
      console.log("  Onumuzdeki 3 gun icinde randevusu olan dosya yok.");
      return;
    }

    console.log(`  ${upcomingFiles.length} dosya bulundu (1-3 gun icinde randevusu var).`);

    let sentCount = 0;
    for (const file of upcomingFiles) {
      // Bugün zaten gönderildi mi?
      if (wasAlreadySent(file.id)) {
        console.log(`  ⏭️  ${file.musteri_ad} - zaten gonderildi, atlaniyor.`);
        continue;
      }

      const staffName = file.profiles?.name || "Bilinmiyor";
      const randevuStr = formatDate(file.randevu_tarihi);

      // Kac gun kaldi hesapla
      const rd = new Date(file.randevu_tarihi);
      rd.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((rd - today) / (1000 * 60 * 60 * 24));
      const daysText = daysLeft === 1 ? "1 gün" : `${daysLeft} gün`;

      const message =
        `📋 *RANDEVU HATIRLATMA*\n\n` +
        `👤 Müşteri: *${file.musteri_ad}*\n` +
        `🌍 Ülke: *${file.hedef_ulke}*\n` +
        `📅 Randevu: *${randevuStr}*\n` +
        `👨‍💼 Çalışan: *${staffName}*\n\n` +
        `⏰ Randevuya *${daysText}* kaldı.\n\n` +
        `_Fox Turizm Vize Yönetim Sistemi_`;

      try {
        await sendMessage(NOTIFY_NUMBER, message);
        markAsSent(file.id);
        sentCount++;
        console.log(`  ✅ ${file.musteri_ad} - ${file.hedef_ulke} - hatirlatma gonderildi.`);

        // Mesajlar arası 2 saniye bekle
        if (upcomingFiles.indexOf(file) < upcomingFiles.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`  ❌ ${file.musteri_ad} - gonderim hatasi:`, err.message);
      }
    }

    // Activity log
    if (sentCount > 0) {
      try {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .single();

        if (adminProfile) {
          await supabase.from("activity_logs").insert({
            type: "whatsapp_reminder",
            message: `WhatsApp hatırlatma: ${sentCount} randevu bildirimi gönderildi (3 gün kala)`,
            actor_id: adminProfile.id,
          });
        }
      } catch {}
    }

    console.log(`\n📊 Sonuc: ${sentCount} hatirlatma gonderildi.\n`);
  } catch (err) {
    console.error("  Randevu kontrol hatasi:", err.message);
  }
}

// ─── Baileys bağlantısı ────────────────────────────────
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  });

  // Bağlantı durumu
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      console.log("\n╔══════════════════════════════════════════════╗");
      console.log("║  WhatsApp QR Kodu - Telefonunuzdan tarayin!  ║");
      console.log("║  WhatsApp > Ayarlar > Bagli Cihazlar         ║");
      console.log("╚══════════════════════════════════════════════╝\n");
      qrcode.generate(qr, { small: true });
      console.log("");
    }

    if (connection === "open") {
      isConnected = true;
      qrCode = null;
      connectionAttempts = 0;
      console.log("\n✅ WhatsApp baglantisi kuruldu!");
      console.log(`📡 HTTP sunucu: http://localhost:${PORT}`);
      console.log("");

      // Bağlandığında hemen randevuları kontrol et
      console.log("🔄 Baslangic randevu kontrolu yapiliyor...");
      await checkAppointments();

      // Periyodik kontrol başlat (her 4 saatte bir)
      if (checkInterval) clearInterval(checkInterval);
      checkInterval = setInterval(() => {
        console.log("\n🔄 Periyodik randevu kontrolu...");
        checkAppointments();
      }, CHECK_INTERVAL);

      console.log(`⏰ Sonraki kontrol: ${CHECK_INTERVAL / 3600000} saat sonra.`);
      console.log("📨 POST /send ile manuel mesaj da gonderebilirsiniz.\n");
    }

    if (connection === "close") {
      isConnected = false;
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`⚠️  Baglanti kapandi. Kod: ${statusCode}.`);

      if (shouldReconnect && connectionAttempts < MAX_RECONNECT) {
        connectionAttempts++;
        const delay = Math.min(connectionAttempts * 2000, 10000);
        console.log(
          `🔄 ${connectionAttempts}/${MAX_RECONNECT} - ${delay / 1000}s sonra tekrar deneniyor...`
        );
        setTimeout(startWhatsApp, delay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log("❌ Oturum kapatildi. QR kodu tekrar taratmaniz gerekiyor.");
        console.log("   auth_info klasorunu silip tekrar baslatin.");
      } else {
        console.log("❌ Maksimum yeniden baglantma denemesine ulasildi.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// ─── Mesaj gönderme ─────────────────────────────────────
async function sendMessage(to, message) {
  if (!isConnected || !sock) {
    throw new Error("WhatsApp bagli degil.");
  }

  let cleanNumber = to.replace(/[\s\-\(\)\+]/g, "");
  if (cleanNumber.startsWith("0")) {
    cleanNumber = "90" + cleanNumber.slice(1);
  } else if (!cleanNumber.startsWith("90") && cleanNumber.length === 10) {
    cleanNumber = "90" + cleanNumber;
  }

  const jid = cleanNumber + "@s.whatsapp.net";
  const result = await sock.sendMessage(jid, { text: message });
  return result;
}

// ─── HTTP Sunucu ────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /status
  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        connected: isConnected,
        hasQR: !!qrCode,
        uptime: process.uptime(),
      })
    );
    return;
  }

  // POST /send
  if (req.method === "POST" && req.url === "/send") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { to, message } = JSON.parse(body);
        if (!to || !message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "to ve message zorunlu" }));
          return;
        }
        const result = await sendMessage(to, message);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, messageId: result?.key?.id, to }));
      } catch (err) {
        console.error("Gonderim hatasi:", err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /check - Manuel randevu kontrolü tetikle
  if (req.method === "POST" && req.url === "/check") {
    res.writeHead(200);
    res.end(JSON.stringify({ message: "Randevu kontrolu baslatildi" }));
    checkAppointments();
    return;
  }

  // GET /
  if (req.method === "GET" && (req.url === "/" || req.url === "")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        service: "Fox Turizm WhatsApp Servisi",
        status: isConnected ? "connected" : "disconnected",
        supabase: !!supabase,
        notifyNumber: NOTIFY_NUMBER ? NOTIFY_NUMBER.slice(0, 4) + "****" : "tanimli degil",
        endpoints: {
          "GET /status": "Baglanti durumu",
          "POST /send": "Mesaj gonder { to, message }",
          "POST /check": "Randevu kontrolunu manuel tetikle",
        },
      })
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Bulunamadi" }));
});

// ─── Başlat ─────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  🦊 Fox Turizm - WhatsApp Bildirim Servisi       ║");
  console.log("║  Baileys + Otomatik Randevu Hatirlatma            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  server.listen(PORT, () => {
    console.log(`📡 HTTP sunucu: http://localhost:${PORT}`);
  });

  await startWhatsApp();
}

main().catch((err) => {
  console.error("Baslatma hatasi:", err);
  process.exit(1);
});
