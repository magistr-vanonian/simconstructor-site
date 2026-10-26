#!/usr/bin/env python3
"""Copy SimConstructor-Release.zip into VPS site storage."""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ssh import connect, env, run

REMOTE_DIR = "/var/www/historyengine/storage/constructor"
REMOTE_ZIP = f"{REMOTE_DIR}/SimConstructor-Release.zip"
REMOTE_META = f"{REMOTE_DIR}/meta.json"


def main() -> int:
    e = env()
    zip_path = os.environ.get("KRISTAL_RELEASE_ZIP") or str(
        Path(__file__).resolve().parents[2] / "SimConstructor-Release.zip"
    )
    src = Path(zip_path)
    if not src.is_file():
        print(f"NO_ZIP {src}")
        return 1
    size = src.stat().st_size
    print(f"upload {src.name} ({size / (1024 * 1024):.1f} MB)")

    client = connect()
    run(client, f"mkdir -p {REMOTE_DIR}", timeout=30)
    sftp = client.open_sftp()
    sftp.put(str(src), REMOTE_ZIP)
    meta = {
        "filename": "SimConstructor-Release.zip",
        "size": size,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "publish-simconstructor-release",
    }
    with sftp.file(REMOTE_META, "w") as handle:
        handle.write(json.dumps(meta, indent=2))
    sftp.close()
    run(
        client,
        f"chown -R historyengine:historyengine {REMOTE_DIR} && chmod 644 {REMOTE_ZIP} {REMOTE_META}",
        timeout=30,
    )
    code, out, err = run(
        client,
        "curl -sS http://127.0.0.1:8787/api/constructor",
        timeout=20,
    )
    sys.stdout.buffer.write((out + err).encode("utf-8", "replace"))
    client.close()
    print("UPLOAD_OK")
    return 0 if code == 0 else code


if __name__ == "__main__":
    sys.exit(main())
