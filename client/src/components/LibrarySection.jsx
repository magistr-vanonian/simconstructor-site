import { useEffect, useRef, useState } from "react";

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) {
    return `${n} Б`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} КБ`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} МБ`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

export default function LibrarySection({ id, title, hint, accept, folder, items, onUploaded }) {
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute("webkitdirectory", "");
      folderRef.current.setAttribute("directory", "");
    }
  }, []);

  async function sendFiles(fileList) {
    if (!fileList || !fileList.length) {
      return;
    }
    setBusy(true);
    setMessage("");
    const body = new FormData();
    Array.from(fileList).forEach((file) => body.append("files", file, file.name));
    const hintName = fileList[0] && (fileList[0].webkitRelativePath || fileList[0].name);
    try {
      const res = await fetch(`/api/library/${id}?name=${encodeURIComponent(hintName || id)}`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить");
      }
      setMessage("Загружено на сервер.");
      if (onUploaded) {
        onUploaded();
      }
    } catch (err) {
      setMessage(err.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (folderRef.current) {
        folderRef.current.value = "";
      }
    }
  }

  return (
    <section className="library-section plaque" id={`lib-${id}`}>
      <div className="library-head">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <div className="library-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
            {busy ? "Загрузка…" : "Загрузить с диска"}
          </button>
          {folder ? (
            <button type="button" className="btn ghost" disabled={busy} onClick={() => folderRef.current && folderRef.current.click()}>
              Папка
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            hidden
            onChange={(ev) => sendFiles(ev.target.files)}
          />
          {folder ? (
            <input
              ref={folderRef}
              type="file"
              multiple
              hidden
              onChange={(ev) => sendFiles(ev.target.files)}
              {...{ webkitdirectory: "", directory: "" }}
            />
          ) : null}
        </div>
      </div>
      {message ? <p className="note">{message}</p> : null}
      {!items.length ? (
        <p className="empty-shelf">На этой полке пока пусто.</p>
      ) : (
        <div className="card-grid">
          {items.map((item) => (
            <article className="item-card" key={item.id}>
              <div className="thumb-wrap">
                <img src={`/api/library/${id}/${item.id}/thumb`} alt="" />
              </div>
              <h3 title={item.originalName}>{item.name}</h3>
              <p className="meta">
                {formatSize(item.size)}
                {item.fileCount > 1 ? ` · ${item.fileCount} файлов` : ""}
              </p>
              <a className="btn slim" href={`/api/library/${id}/${item.id}/download`}>
                Скачать
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
