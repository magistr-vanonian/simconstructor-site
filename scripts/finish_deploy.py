import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ssh import connect, env, run

REMOTE = "/var/www/historyengine"


def main() -> int:
    e = env()
    token = e.get("PUBLISH_TOKEN") or secrets.token_urlsafe(24)
    origin = e.get("PUBLIC_ORIGIN") or "https://historyengine.ru"
    c = connect()

    env_body = f"PORT=8787\nHOST=127.0.0.1\nPUBLIC_ORIGIN={origin}\nPUBLISH_TOKEN={token}\n"
    sftp = c.open_sftp()
    with sftp.file(f"{REMOTE}/.env", "w") as handle:
        handle.write(env_body)
    sftp.close()

    local = Path(__file__).resolve().parents[1] / ".env.deploy"
    text = local.read_text(encoding="utf-8")
    if "PUBLISH_TOKEN=" in text:
        lines = []
        for line in text.splitlines():
            if line.startswith("PUBLISH_TOKEN="):
                lines.append(f"PUBLISH_TOKEN={token}")
            else:
                lines.append(line)
        local.write_text("\n".join(lines) + "\n", encoding="utf-8")
    else:
        local.write_text(text.rstrip() + f"\nPUBLISH_TOKEN={token}\n", encoding="utf-8")

    cmds = [
        f"chown historyengine:historyengine {REMOTE}/.env && chmod 600 {REMOTE}/.env && systemctl restart historyengine && sleep 1",
        "curl -sS http://127.0.0.1:8787/api/health; echo",
        "curl -sS -o /dev/null -w 'home:%{http_code}\n' http://127.0.0.1:8787/",
        "curl -sS -o /dev/null -w 'res:%{http_code}\n' http://127.0.0.1:8787/resources",
        "curl -sS -o /dev/null -w 'guide:%{http_code}\n' http://127.0.0.1:8787/guide",
        "export DEBIAN_FRONTEND=noninteractive; apt-get install -y -o Dpkg::Use-Pty=0 certbot python3-certbot-nginx",
    ]
    for cmd in cmds:
        code, out, err = run(c, cmd, timeout=180)
        sys.stdout.buffer.write((out + err).encode("utf-8", "replace"))
        if code != 0:
            print(f"CMD_FAIL {code}: {cmd[:80]}")
            c.close()
            return code

    code, out, err = run(
        c,
        "certbot --nginx -d historyengine.ru -d www.historyengine.ru --non-interactive --agree-tos --register-unsafely-without-email --redirect || true",
        timeout=120,
    )
    sys.stdout.buffer.write((out + err).encode("utf-8", "replace"))
    c.close()
    print("FINISH_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
