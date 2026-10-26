import sys
from pathlib import Path
import paramiko

def env():
    out = {}
    for line in (Path(__file__).resolve().parents[1] / ".env.deploy").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out

def connect():
    e = env()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        hostname=e["DEPLOY_HOST"],
        port=int(e.get("DEPLOY_PORT") or 22),
        username=e.get("DEPLOY_USER") or "root",
        password=e.get("DEPLOY_PASSWORD") or "",
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=25,
        auth_timeout=25,
    )
    return c

def run(c, cmd, timeout=120):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err

if __name__ == "__main__":
    cmd = " ".join(sys.argv[1:])
    c = connect()
    code, out, err = run(c, cmd, timeout=180)
    sys.stdout.buffer.write((out + err).encode("utf-8", "replace"))
    c.close()
    sys.exit(code)
