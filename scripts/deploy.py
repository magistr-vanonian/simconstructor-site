#!/usr/bin/env python3
"""Upload simconstructor-site to the VPS and enable nginx + systemd."""

from __future__ import annotations

import io
import re
import secrets
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "__pycache__",
    ".cursor",
    "storage",
}
SKIP_FILES = {
    ".env.deploy",
    ".env",
}

VERSION_RE = re.compile(r"^\d+(\.\d+){0,3}$")
VERSION_FILE = ROOT / "content" / "constructor-version.txt"


def parse_version_arg(argv: list[str]) -> str | None:
    if len(argv) <= 1:
        return None
    if argv[1] in ("-h", "--help"):
        print("usage: python scripts/deploy.py [version]")
        print("  version  written to content/constructor-version.txt (example: 1.0.1)")
        raise SystemExit(0)
    if argv[1] in ("--version", "-v"):
        if len(argv) < 3:
            raise SystemExit("deploy.py: --version needs a value like 1.0.1")
        return argv[2]
    if argv[1].startswith("-"):
        raise SystemExit(f"deploy.py: unknown option {argv[1]}")
    return argv[1]


def write_version_file(version: str) -> None:
    text = version.strip()
    if not VERSION_RE.fullmatch(text):
        raise SystemExit(f"deploy.py: bad version '{version}' (use 1.0.1)")
    VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    VERSION_FILE.write_text(text + "\n", encoding="ascii")
    print(f"constructor-version.txt <- {text}")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env.deploy"
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def build_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:

        def filter_tar(info: tarfile.TarInfo):
            parts = Path(info.name).parts
            if any(part in SKIP_DIRS for part in parts):
                return None
            if Path(info.name).name in SKIP_FILES:
                return None
            if info.name.endswith(".pyc"):
                return None
            return info

        tar.add(ROOT, arcname=".", filter=filter_tar)
    return buf.getvalue()


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(text.encode("utf-8", "replace") + b"\n")
        sys.stdout.buffer.flush()


def run(client: paramiko.SSHClient, command: str, timeout: int = 180) -> str:
    safe_print(f"$ {command[:180]}")
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).strip()
    if text:
        safe_print(text[-4000:])
    if code != 0:
        raise RuntimeError(f"remote exit {code}: {command}")
    return out


def main() -> int:
    version = parse_version_arg(sys.argv)
    if version:
        write_version_file(version)
    elif VERSION_FILE.is_file():
        print(f"constructor-version.txt: {VERSION_FILE.read_text(encoding='utf-8').strip()}")
    else:
        print("constructor-version.txt: missing (pass a version, e.g. python scripts/deploy.py 1.0.1)")

    env = load_env()
    host = env["DEPLOY_HOST"]
    port = int(env.get("DEPLOY_PORT") or 22)
    user = env.get("DEPLOY_USER") or "root"
    password = env.get("DEPLOY_PASSWORD") or ""
    remote_path = env.get("DEPLOY_PATH") or "/var/www/historyengine"
    origin = env.get("PUBLIC_ORIGIN") or "https://historyengine.ru"
    token = env.get("PUBLISH_TOKEN") or secrets.token_urlsafe(24)

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print("packing site...")
    archive = build_tarball()
    print(f"archive {len(archive)} bytes")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"ssh {user}@{host}:{port}")
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=25,
        auth_timeout=25,
    )

    sftp = client.open_sftp()
    sftp.putfo(io.BytesIO(archive), "/tmp/historyengine-site.tgz")
    sftp.close()
    print("uploaded tarball")

    setup = r"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y -o Dpkg::Use-Pty=0 nginx curl ca-certificates gnupg xz-utils
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
id historyengine >/dev/null 2>&1 || useradd --system --home /var/www/historyengine --shell /usr/sbin/nologin historyengine
mkdir -p __REMOTE__
tar -xzf /tmp/historyengine-site.tgz -C __REMOTE__
cd __REMOTE__
npm install --omit=dev
npm --prefix client install
npm --prefix client run build
chown -R historyengine:historyengine __REMOTE__
if [ ! -f /etc/letsencrypt/live/historyengine.ru/fullchain.pem ]; then
  install -m 644 __REMOTE__/scripts/historyengine.nginx.conf /etc/nginx/sites-available/historyengine
  ln -sfn /etc/nginx/sites-available/historyengine /etc/nginx/sites-enabled/historyengine
fi
rm -f /etc/nginx/sites-enabled/default
install -m 644 __REMOTE__/scripts/historyengine.service /etc/systemd/system/historyengine.service
nginx -t
systemctl daemon-reload
systemctl enable --now nginx historyengine
systemctl reload nginx
systemctl restart historyengine
systemctl is-active nginx historyengine
ss -lntp | sed -n '1,20p'
"""
    setup = setup.replace("__REMOTE__", remote_path)
    run(client, setup, timeout=600)

    env_file = (
        f"PORT=8787\nHOST=127.0.0.1\nPUBLIC_ORIGIN={origin}\nPUBLISH_TOKEN={token}\n"
    )
    sftp = client.open_sftp()
    with sftp.file(f"{remote_path}/.env", "w") as handle:
        handle.write(env_file)
    sftp.close()
    run(client, f"chown historyengine:historyengine {remote_path}/.env && systemctl restart historyengine")

    local_env = ROOT / ".env.deploy"
    text = local_env.read_text(encoding="utf-8")
    if "PUBLISH_TOKEN=" not in text:
        local_env.write_text(text.rstrip() + f"\nPUBLISH_TOKEN={token}\n", encoding="utf-8")

    print("waiting for local node...")
    time.sleep(2)
    run(client, "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:8787/api/health")
    run(client, "curl -sS -o /dev/null -w '%{http_code}\\n' -H 'Host: historyengine.ru' http://127.0.0.1/api/health")

    print("DEPLOY_OK")
    client.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"DEPLOY_FAIL {type(exc).__name__}: {exc}")
        sys.exit(1)
