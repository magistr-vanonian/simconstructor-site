import { useEffect, useMemo, useRef, useState } from "react";
import {
  collectDroppedFiles,
  extractGemAssets,
  filterNeededFiles,
  groupByFolder,
  matchIncomingFiles,
} from "../lib/gemAssets.js";
import { closeScenePickerWindow, openScenePickerWindow, syncScenePickerWindow } from "../lib/scenePickerWindow.js";

function isGem(file) {
  return Boolean(file && /\.gem$/i.test(file.name || ""));
}

function mergeBag(prev, incoming) {
  const next = [...prev];
  for (const file of incoming) {
    const rel = String(file._rel || file.webkitRelativePath || file.name || "").toLowerCase();
    const idx = next.findIndex((item) => {
      const other = String(item._rel || item.webkitRelativePath || item.name || "").toLowerCase();
      return other === rel || (item.name.toLowerCase() === file.name.toLowerCase() && !item.webkitRelativePath && !file.webkitRelativePath && !item._rel && !file._rel);
    });
    if (idx >= 0) {
      next[idx] = file;
    } else {
      next.push(file);
    }
  }
  return next;
}

function safeFileName(name) {
  const trimmed = String(name || "scene.gem").replace(/[<>:"|?*\\/]/g, "_").trim();
  return trimmed || "scene.gem";
}

function takenNote(kept, total) {
  if (!total) {
    return "";
  }
  if (total - kept > 0) {
    return `Принято ${kept} из ${total} по имени, лишние отброшены.`;
  }
  return `Принято файлов: ${kept}.`;
}

export default function SceneUploadWizard({ categoryId, accept, onUploaded }) {
  const gemRef = useRef(null);
  const filesRef = useRef(null);
  const pickerRef = useRef(null);
  const ingestRef = useRef(null);
  const pickerModeRef = useRef("files");
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [gemFile, setGemFile] = useState(null);
  const [needed, setNeeded] = useState([]);
  const [bag, setBag] = useState([]);

  const matched = useMemo(() => matchIncomingFiles(needed, bag), [needed, bag]);
  const foundCount = needed.filter((item) => matched.assigned[item.rel]).length;
  const missingCount = needed.length - foundCount;
  const grouped = useMemo(() => groupByFolder(needed), [needed]);

  async function applyGem(file, extraFiles) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Не удалось прочитать сцену. Нужен файл .gem.");
    }
    const list = extractGemAssets(data);
    const incoming = extraFiles || [];
    const { kept } = filterNeededFiles(incoming, list);
    setGemFile(file);
    setNeeded(list);
    setTitle((current) => current || file.name.replace(/\.gem$/i, ""));
    setBag((prev) => mergeBag(filterNeededFiles(prev, list).kept, kept));
    const base = list.length ? `Нужно ещё объектов: ${list.length}.` : "Дополнительных объектов в сцене не найдено.";
    const taken = takenNote(kept.length, incoming.length);
    setMessage(taken ? `${base} ${taken}` : base);
    pickerModeRef.current = "files";
  }

  async function ingest(files) {
    if (!files || !files.length) {
      return;
    }
    const list = Array.from(files);
    const gems = list.filter(isGem);
    const rest = list.filter((file) => !isGem(file));
    try {
      if (gems.length) {
        await applyGem(gems[0], [...rest, ...gems.slice(1)]);
        return;
      }
      if (!gemFile) {
        setMessage("Сначала разместите файл сцены .gem.");
        return;
      }
      const { kept } = filterNeededFiles(rest, needed);
      if (!rest.length) {
        return;
      }
      setBag((prev) => mergeBag(prev, kept));
      setMessage(
        kept.length
          ? takenNote(kept.length, rest.length)
          : `Среди ${rest.length} файлов нет нужных по имени.`
      );
    } catch (err) {
      setMessage(err.message || "Не удалось разобрать сцену");
    }
  }

  ingestRef.current = ingest;

  function openPicker(mode) {
    pickerModeRef.current = mode;
    const popup = openScenePickerWindow({
      mode,
      accept: mode === "gem" ? ".gem,application/json" : accept,
      needed,
      assigned: matched.assigned,
    });
    if (!popup) {
      if (mode === "gem") {
        gemRef.current && gemRef.current.click();
      } else {
        filesRef.current && filesRef.current.click();
      }
      return;
    }
    pickerRef.current = popup;
  }

  useEffect(() => {
    function onMessage(ev) {
      if (ev.origin !== window.location.origin || !ev.data) {
        return;
      }
      if (ev.data.type === "kristal-scene-files") {
        ingestRef.current(ev.data.files || []);
        return;
      }
      if (ev.data.type === "kristal-scene-files-buf") {
        const rebuilt = (ev.data.files || []).map(
          (item) => new File([item.buffer], item.name, { type: item.type, lastModified: item.lastModified })
        );
        ingestRef.current(rebuilt);
        return;
      }
      if (ev.data.type === "kristal-picker-ready") {
        syncScenePickerWindow(pickerRef.current, {
          mode: pickerModeRef.current,
          accept: pickerModeRef.current === "gem" ? ".gem,application/json" : accept,
          needed,
          assigned: matched.assigned,
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [accept, needed, matched.assigned]);

  useEffect(() => {
    syncScenePickerWindow(pickerRef.current, {
      mode: pickerModeRef.current,
      accept: pickerModeRef.current === "gem" ? ".gem,application/json" : accept,
      needed,
      assigned: matched.assigned,
    });
  }, [accept, needed, matched.assigned]);

  useEffect(() => {
    return () => closeScenePickerWindow(pickerRef.current);
  }, []);

  async function onDrop(ev) {
    ev.preventDefault();
    setHot(false);
    const files = await collectDroppedFiles(ev.dataTransfer);
    ingest(files);
  }

  function resetAssets() {
    setBag([]);
    setMessage(gemFile ? "Список объектов сцены сохранён, выбранные файлы сброшены." : "");
  }

  function resetAll() {
    setGemFile(null);
    setNeeded([]);
    setBag([]);
    setTitle("");
    setMessage("");
    if (gemRef.current) {
      gemRef.current.value = "";
    }
    if (filesRef.current) {
      filesRef.current.value = "";
    }
    closeScenePickerWindow(pickerRef.current);
    pickerRef.current = null;
  }

  async function confirm() {
    if (!gemFile) {
      setMessage("Сначала разместите файл сцены .gem.");
      return;
    }
    setBusy(true);
    setMessage("");
    const gemName = safeFileName(gemFile.name);
    const body = new FormData();
    body.append(`file:${encodeURIComponent(`Simulations/${gemName}`)}`, gemFile, gemName);
    for (const item of needed) {
      const file = matched.assigned[item.rel];
      if (!file) {
        continue;
      }
      body.append(`file:${encodeURIComponent(item.rel)}`, file, file.name);
    }
    const hintName = (title || gemName.replace(/\.gem$/i, "") || categoryId).trim();
    try {
      const res = await fetch(`/api/library/${categoryId}?name=${encodeURIComponent(hintName)}&layout=assets`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить");
      }
      resetAll();
      setMessage("Сцена размещена по папкам и загружена на сервер.");
      if (onUploaded) {
        onUploaded();
      }
    } catch (err) {
      setMessage(err.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scene-wizard">
      <label className="scene-title-field">
        Название на полке
        <input
          type="text"
          value={title}
          disabled={busy}
          placeholder="Как подписать сцену"
          onChange={(ev) => setTitle(ev.target.value)}
        />
      </label>

      <div
        className={`drop-zone${hot ? " is-hot" : ""}`}
        onDragEnter={(ev) => {
          ev.preventDefault();
          setHot(true);
        }}
        onDragOver={(ev) => {
          ev.preventDefault();
          setHot(true);
        }}
        onDragLeave={() => setHot(false)}
        onDrop={onDrop}
      >
        <p>
          {gemFile
            ? "Можно выделить все файлы пачкой — возьмутся только нужные по имени."
            : "Сначала перетащите сюда файл сцены .gem."}
        </p>
        {gemFile ? <p className="drop-zone-meta">Сцена: {gemFile.name}</p> : null}
        <div className="drop-zone-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => openPicker("gem")}>
            Выбрать сцену .gem
          </button>
          <button type="button" className="btn ghost" disabled={busy || !gemFile} onClick={() => openPicker("files")}>
            Выбрать файлы
          </button>
        </div>
        <p className="drop-zone-hint">
          Проводник откроется в отдельном окне. Можно выбрать всё сразу: лишние файлы отбросятся по имени.
        </p>
      </div>

      <input
        ref={gemRef}
        type="file"
        accept=".gem,application/json"
        hidden
        onChange={(ev) => {
          ingest(ev.target.files);
          ev.target.value = "";
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(ev) => {
          ingest(ev.target.files);
          ev.target.value = "";
        }}
      />

      {gemFile ? (
        <div className="need-panel">
          <div className="need-head">
            <h3>Необходимые объекты</h3>
            <p>
              {needed.length
                ? `${foundCount} из ${needed.length} на месте${missingCount ? `, не хватает ${missingCount}` : ""}`
                : "Дополнительных файлов не требуется"}
            </p>
          </div>
          {grouped.length ? (
            grouped.map(([folder, items]) => (
              <div className="need-group" key={folder}>
                <h4>{folder}</h4>
                <ul>
                  {items.map((item) => {
                    const ready = Boolean(matched.assigned[item.rel]);
                    return (
                      <li key={item.rel} className={ready ? "is-ready" : "is-missing"}>
                        <span className="need-name">{item.name}</span>
                        <span className="need-state">{ready ? "есть" : "нужен"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <p className="note">Можно подтверждать — на полку уйдёт только сцена.</p>
          )}
          <div className="scene-wizard-actions">
            <button type="button" className="btn ghost" disabled={busy || (!bag.length && !gemFile)} onClick={resetAssets}>
              Сбросить файлы
            </button>
            <button type="button" className="btn" disabled={busy} onClick={confirm}>
              {busy
                ? "Размещение…"
                : missingCount
                  ? `Разместить без ${missingCount} файлов`
                  : "Подтвердить и разместить"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p className="note">{message}</p> : null}
    </div>
  );
}
