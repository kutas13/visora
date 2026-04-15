import paramiko
import sys

HOST = "38.242.149.170"
USER = "root"
PASSWORD = "73RrPs8nF7EQ"

OLD_LINE = '    const result = await sock.sendMessage(jid, { text: message });'
NEW_LINES = '''    const footer = "\\n\\n---\\n_Bu mesaj Fox Turizm Vize Sistemi tarafindan otomatik olarak gonderilmistir._";
    const result = await sock.sendMessage(jid, { text: message + footer });'''


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, allow_agent=False,
              look_for_keys=False, timeout=10)

    # Read current file
    stdin, stdout, stderr = c.exec_command("cat /root/whatsapp-service/index.js", timeout=30)
    content = stdout.read().decode("utf-8", "replace")

    if OLD_LINE not in content:
        print("OLD_LINE bulunamadi, dosya zaten guncel olabilir")
        c.close()
        return

    new_content = content.replace(OLD_LINE, NEW_LINES)

    # Write back
    escaped = new_content.replace("\\", "\\\\").replace("$", "\\$").replace("`", "\\`").replace('"', '\\"')
    write_cmd = f'printf "%s" "{escaped}" > /root/whatsapp-service/index.js'

    # Safer: use heredoc via stdin
    stdin2, stdout2, stderr2 = c.exec_command("cat > /root/whatsapp-service/index.js", timeout=30)
    stdin2.write(new_content)
    stdin2.channel.shutdown_write()
    stdout2.read()

    # Verify syntax
    stdin3, stdout3, stderr3 = c.exec_command("cd /root/whatsapp-service && node -c index.js && echo SYNTAX_OK", timeout=30)
    result = stdout3.read().decode("utf-8", "replace") + stderr3.read().decode("utf-8", "replace")
    sys.stdout.buffer.write(result.encode("utf-8", "replace"))

    # Show the changed part
    stdin4, stdout4, stderr4 = c.exec_command("grep -n 'footer\\|sendMessage' /root/whatsapp-service/index.js", timeout=30)
    result2 = stdout4.read().decode("utf-8", "replace")
    sys.stdout.buffer.write(b"\n=== DEGISEN SATIRLAR ===\n")
    sys.stdout.buffer.write(result2.encode("utf-8", "replace"))

    # Restart PM2 if running
    stdin5, stdout5, stderr5 = c.exec_command("pm2 restart whatsapp-service 2>&1 || echo PM2_NOT_RUNNING", timeout=30)
    result3 = stdout5.read().decode("utf-8", "replace")
    sys.stdout.buffer.write(b"\n=== PM2 RESTART ===\n")
    sys.stdout.buffer.write(result3.encode("utf-8", "replace"))

    c.close()
    print("\nTAMAM - Footer eklendi.")


if __name__ == "__main__":
    main()
