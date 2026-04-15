import paramiko
import sys

HOST = "38.242.149.170"
USER = "root"
PASSWORD = "73RrPs8nF7EQ"

DISCOVERY_CMD = r"""
set -e
echo '=== WHOAMI ==='
whoami
echo '=== NODE ==='
node -v || true
echo '=== PM2 ==='
pm2 ls || true
echo '=== SYSTEMD WA CANDIDATES ==='
systemctl list-unit-files --type=service | egrep -i 'wa|whatsapp|bot|fox' || true
echo '=== PROCESS CANDIDATES ==='
ps aux | egrep -i 'whatsapp|baileys|node.*index.js|pm2' | egrep -v 'egrep' || true
echo '=== COMMON PATHS ==='
for p in /root /home /opt /srv; do
  [ -d "$p" ] && find "$p" -maxdepth 3 -type f -name 'index.js' 2>/dev/null | head -n 20
done
"""


def run_command(client: paramiko.SSHClient, cmd: str, timeout: int = 60) -> str:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out + ("\n[stderr]\n" + err if err.strip() else "")


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=HOST,
        username=USER,
        password=PASSWORD,
        timeout=10,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=10,
        auth_timeout=10,
    )

    output = run_command(client, DISCOVERY_CMD, timeout=120)
    sys.stdout.buffer.write(output.encode("utf-8", errors="replace"))
    sys.stdout.buffer.write(b"\n")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
