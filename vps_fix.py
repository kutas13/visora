import paramiko
import sys

HOST = "38.242.149.170"
USER = "root"
PASSWORD = "73RrPs8nF7EQ"


def run(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out + ("\n[STDERR]\n" + err if err.strip() else "")


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, allow_agent=False,
              look_for_keys=False, timeout=10)

    # Step 1: Read VPS index.js
    print("=== VPS INDEX.JS ===")
    out = run(c, "cat /root/whatsapp-service/index.js")
    sys.stdout.buffer.write(out.encode("utf-8", "replace"))

    c.close()


if __name__ == "__main__":
    main()
