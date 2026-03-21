import paramiko, sys

host = "38.242.149.170"
user = "root"
passwords = ["47504750Ff*", "uzFw6A3Dka7YgSvH6hCu5", "Yusuf.4750/*"]

for pwd in passwords:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        print(f"Sifre '{pwd[:4]}...' deneniyor...", end=" ")
        client.connect(host, port=22, username=user, password=pwd, timeout=10)
        print("BASARILI!")
        cmd = sys.argv[1] if len(sys.argv) > 1 else "whoami && hostname && uptime"
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out: print(out)
        if err: print("STDERR:", err)
        client.close()
        sys.exit(0)
    except Exception as e:
        print(f"HATA: {e}")
        try: client.close()
        except: pass
print("Hicbir sifre calismadi.")
