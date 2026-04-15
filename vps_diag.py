import paramiko
import sys

HOST = "38.242.149.170"
USER = "root"
PASSWORD = "73RrPs8nF7EQ"

CMDS = r"""
set -e

echo '=== BAILEYS VERSION ==='
cd /root/whatsapp-service
node -e "console.log(require('@whiskeysockets/baileys/package.json').version)"

echo '=== NODE VERSION ==='
node -v

echo '=== PACKAGE.JSON ==='
cat /root/whatsapp-service/package.json

echo '=== AUTH DIR ==='
ls -la /root/whatsapp-service/auth_info/ 2>&1 || true

echo '=== RUNNING NODE ==='
ps aux | grep -E 'node|pm2' | grep -v grep || true

echo '=== PM2 LIST ==='
pm2 ls 2>&1 || true

echo '=== DISK ==='
df -h /

echo '=== ENV FILE ==='
cat /root/whatsapp-service/../.env.local 2>/dev/null | head -20 || echo "NO .env.local"

echo '=== INDEX.JS CONNECTION UPDATE HANDLER ==='
grep -n 'connection.update\|qr\|printQR\|connection.*open\|connection.*close' /root/whatsapp-service/index.js || true
"""


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, allow_agent=False,
              look_for_keys=False, timeout=10)
    stdin, stdout, stderr = c.exec_command(CMDS, timeout=60)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    sys.stdout.buffer.write(out.encode("utf-8", "replace"))
    if err.strip():
        sys.stdout.buffer.write(b"\n[STDERR]\n")
        sys.stdout.buffer.write(err.encode("utf-8", "replace"))
    c.close()


if __name__ == "__main__":
    main()
