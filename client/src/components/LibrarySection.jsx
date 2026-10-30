import { useEffect, useRef, useState } from "react";
import { validateLibraryFiles } from "../lib/libraryRules.js";
import SceneUploadWizard from "./SceneUploadWizard.jsx";

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

function uploadHintName(fileList, fallback) {
  const first = fileList && fileList[0];
  if (!first) {
    return fallback;
  }
  const rel = String(first.webkitRelativePath || "").replace(/\\/g, "/");
  const top = rel.split("/").filter(Boolean)[0];
  return top || first.name || fallback;
}

export default function LibrarySection({
  id,
  title,
  hint,
  accept,
  folder,
  folderOnly,
  sceneWizard,
  note,
  downloadNote,
  items,
  onUploaded,
}) {
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

  async function inspectFiles(fileList) {
    const files = Array.from(fileList || []);
    const payload = [];
    for (const file of files) {
      const rel = file.webkitRelativePath || file.name;
      const item = { rel, name: file.name };
      if (file.name.toLowerCase() === "kristal.build.json") {
        try {
          item.text = await file.text();
        } catch {
          item.text = "";
        }
      }
      payload.push(item);
    }
    return payload;
  }

  async function sendFiles(fileList) {
    if (!fileList || !fileList.length) {
      return;
    }
    const inspected = await inspectFiles(fileList);
    const blocked = validateLibraryFiles(id, inspected);
    if (blocked) {
      setMessage(blocked);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (folderRef.current) {
        folderRef.current.value = "";
      }
      return;
    }
    setBusy(true);
    setMessage("");
    const body = new FormData();
    Array.from(fileList).forEach((file) => {
      const rel = file.webkitRelativePath || file.name;
      if (file.webkitRelativePath) {
        body.append(`file:${encodeURIComponent(rel)}`, file);
      } else {
        body.append("files", file, file.name);
      }
    });
    const hintName = uploadHintName(fileList, id);
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
        {sceneWizard ? null : (
          <div className="library-actions">
            {folderOnly ? null : (
              <button type="button" className="btn ghost" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
                {busy ? "Загрузка…" : "Загрузить с диска"}
              </button>
            )}
            {folder ? (
              <button type="button" className="btn ghost" disabled={busy} onClick={() => folderRef.current && folderRef.current.click()}>
                {busy ? "Загрузка…" : folderOnly ? "Загрузить папку" : "Папка"}
              </button>
            ) : null}
            {folderOnly ? null : (
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                multiple
                hidden
                onChange={(ev) => sendFiles(ev.target.files)}
              />
            )}
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
        )}
      </div>
      {note ? <p className="shelf-note">{note}</p> : null}
      {downloadNote ? <p className="shelf-note">{downloadNote}</p> : null}
      {sceneWizard ? <SceneUploadWizard categoryId={id} accept={accept} onUploaded={onUploaded} /> : null}
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
