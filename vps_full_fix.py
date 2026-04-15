import paramiko
import sys
import time

HOST = "38.242.149.170"
USER = "root"
PASSWORD = "73RrPs8nF7EQ"


def run(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    result = out + ("\n[STDERR]\n" + err if err.strip() else "")
    sys.stdout.buffer.write(result.encode("utf-8", "replace"))
    sys.stdout.buffer.write(b"\n")
    sys.stdout.buffer.flush()
    return result


NEW_INDEX_JS = r'''const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const express = require("express");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

const app = express();
app.use(express.json());

const AUTH_DIR = "./auth_info_baileys";
const logger = pino({ level: "silent" });

let sock = null;
let isConnected = false;
let qrCode = null;
let connectionAttempts = 0;

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
    browser: ["Fox Turizm", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      console.log("\n=== QR KOD ===\n");
      qrcode.generate(qr, { small: true });
      console.log("\n==============\n");
    }

    if (connection === "open") {
      isConnected = true;
      qrCode = null;
      connectionAttempts = 0;
      console.log("✅ WhatsApp bağlantısı kuruldu!");
    }

    if (connection === "close") {
      isConnected = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("❌ Bağlantı kapandı. Sebep:", reason);

      if (reason === DisconnectReason.loggedOut) {
        console.log("⚠️ Oturum kapandı. auth_info_baileys silinip yeniden QR taratılmalı.");
      } else if (connectionAttempts < 10) {
        connectionAttempts++;
        const delay = Math.min(connectionAttempts * 2000, 15000);
        console.log(`🔄 ${connectionAttempts}/10 - ${delay/1000}sn sonra yeniden bağlanılıyor...`);
        setTimeout(startWhatsApp, delay);
      } else {
        console.log("❌ Maksimum denemeye ulaşıldı.");
      }
    }
  });
}

app.get("/status", (req, res) => {
  res.json({ connected: isConnected, qrPending: !!qrCode });
});

app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: "to ve message zorunlu" });
    if (!isConnected || !sock) return res.status(503).json({ error: "WhatsApp bağlı değil" });

    let jid = to.replace(/[^0-9]/g, "");
    if (!jid.endsWith("@s.whatsapp.net")) jid = jid + "@s.whatsapp.net";

    const result = await sock.sendMessage(jid, { text: message });
    console.log(`📤 Mesaj gönderildi: ${to}`);
    res.json({ success: true, messageId: result?.key?.id, to: jid });
  } catch (err) {
    console.error("Mesaj hatası:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    service: "Fox Turizm WhatsApp Service",
    status: isConnected ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 WhatsApp servisi http://0.0.0.0:${PORT}`);
  startWhatsApp();
});
'''

PAIR_SCRIPT = r'''const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

const AUTH_DIR = "./auth_info_baileys";
const logger = pino({ level: "silent" });
let connected = false;

async function pair() {
  if (connected) return;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: ["Fox Turizm", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u) => {
    if (u.qr) {
      console.log("\n=== YENI QR (BUNU OKUT) ===\n");
      qrcode.generate(u.qr, { small: true });
      console.log("\n===========================\n");
    }
    if (u.connection === "open") {
      connected = true;
      console.log("\nBAGLANDI ✅\n");
      setTimeout(() => process.exit(0), 4000);
    }
    if (u.connection === "close" && !connected) {
      const code = u?.lastDisconnect?.error?.output?.statusCode;
      console.log("KAPANDI code=" + code + " -> 3sn sonra yeni QR...");
      setTimeout(pair, 3000);
    }
  });
}

pair();
setTimeout(() => { if (!connected) { console.log("TIMEOUT 3dk"); process.exit(2); } }, 180000);
'''


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, allow_agent=False,
              look_for_keys=False, timeout=10)

    # Step 1: Kill everything
    print(">>> Killing all processes...")
    run(c, "cd /root/whatsapp-service && pm2 stop all >/dev/null 2>&1; pm2 delete all >/dev/null 2>&1; pkill -f 'node' 2>/dev/null; sleep 2; echo DONE")

    # Step 2: Clean BOTH auth directories
    print(">>> Cleaning auth directories...")
    run(c, "cd /root/whatsapp-service && rm -rf auth_info auth_info_baileys && mkdir -p auth_info_baileys && echo DONE")

    # Step 3: Install pino if missing
    print(">>> Ensuring pino is installed...")
    run(c, "cd /root/whatsapp-service && npm ls pino 2>&1 | grep pino || npm install pino && echo DONE")

    # Step 4: Backup and replace index.js
    print(">>> Updating index.js...")
    escaped = NEW_INDEX_JS.replace("'", "'\\''")
    run(c, f"cd /root/whatsapp-service && cp index.js index.js.bak && echo '{escaped}' > index.js && echo DONE")

    # Step 5: Write pair script
    print(">>> Writing pair script...")
    escaped_pair = PAIR_SCRIPT.replace("'", "'\\''")
    run(c, f"cd /root/whatsapp-service && echo '{escaped_pair}' > pair.js && echo DONE")

    # Step 6: Verify files
    print(">>> Verifying...")
    run(c, "cd /root/whatsapp-service && ls -la auth_info_baileys/ && echo --- && head -5 index.js && echo --- && head -5 pair.js && echo DONE")

    print("\n\n=== HAZIR ===")
    print("Simdi SSH'de su komutu calistir:")
    print("  cd /root/whatsapp-service && node pair.js")
    print("QR'i okut, BAGLANDI gordukten sonra:")
    print("  pm2 start index.js --name whatsapp-service && pm2 save")

    c.close()


if __name__ == "__main__":
    main()
