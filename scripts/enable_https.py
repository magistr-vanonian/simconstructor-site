import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ssh import connect, run


def main() -> int:
    c = connect()
    cmds = [
        "ss -lntp | sed -n '1,25p'",
        "command -v certbot && certbot --version",
        "ufw status || true",
        "ufw allow 80/tcp || true",
        "ufw allow 443/tcp || true",
        "ufw allow OpenSSH || true",
        "curl -sS -o /dev/null -w 'local80:%{http_code}\\n' -H 'Host: historyengine.ru' http://127.0.0.1/",
        "certbot --nginx -d historyengine.ru -d www.historyengine.ru --non-interactive --agree-tos --redirect --register-unsafely-without-email",
        "systemctl reload nginx",
        "ss -lntp | sed -n '1,25p'",
        "curl -sS -o /dev/null -w 'https:%{http_code} redir:%{redirect_url}\\n' -k https://127.0.0.1/ -H 'Host: historyengine.ru'",
        "curl -sS -o /dev/null -w 'http:%{http_code} redir:%{redirect_url}\\n' http://127.0.0.1/ -H 'Host: historyengine.ru'",
    ]
    for cmd in cmds:
        print(f"$ {cmd[:120]}")
        code, out, err = run(c, cmd, timeout=180)
        text = (out + err).strip()
        if text:
            sys.stdout.buffer.write((text[-5000:] + "\n").encode("utf-8", "replace"))
        if code != 0 and cmd.startswith("certbot"):
            print(f"CERTBOT_FAIL {code}")
            c.close()
            return code
        if code != 0 and cmd.startswith("ufw allow"):
            continue
        if code != 0 and "ufw status" in cmd:
            continue
    c.close()
    print("HTTPS_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
