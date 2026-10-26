const PICKER_NAME = "kristal-scene-picker";
const FEATURES = "popup=yes,width=460,height=640,left=48,top=48,resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no";

function pickerHtml() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Выбор файлов сцены</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Spectral:ital,wght@0,400;0,600&display=swap" rel="stylesheet" />
  <style>
    :root { --ink:#ead9b4; --muted:#b49a72; --gold:#d7b45a; --gold-2:#f3dd9a; --line:rgba(215,180,90,.38); }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      color: var(--ink);
      background: linear-gradient(180deg, #120c07 0%, #090704 100%);
      font-family: Spectral, "Times New Roman", serif;
      padding: 16px;
    }
    h1, h2, button { font-family: Cinzel, Palatino, serif; }
    h1 { margin: 0 0 8px; font-size: 16px; letter-spacing: .08em; text-transform: uppercase; color: var(--gold-2); }
    .hint { margin: 0 0 14px; color: var(--muted); font-size: 14px; line-height: 1.45; }
    button {
      appearance: none;
      border: 1px solid var(--gold);
      background: linear-gradient(180deg, #4a3418, #2a1b0d);
      color: var(--gold-2);
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: 12px;
      padding: 10px 14px;
      cursor: pointer;
      width: 100%;
    }
    button:hover { background: #5a3e1b; }
    input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .status { margin: 10px 0 0; min-height: 1.3em; color: var(--gold); font-size: 13px; }
    .need-head { display: flex; justify-content: space-between; gap: 8px; margin: 16px 0 8px; }
    .need-head h2 { margin: 0; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--gold); }
    .need-head span { color: var(--muted); font-size: 13px; }
    .group { margin-top: 10px; }
    .group h3 { margin: 0; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--gold); font-family: Cinzel, Palatino, serif; }
    ul { list-style: none; margin: 6px 0 0; padding: 0; }
    li { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(215,180,90,.12); font-size: 13px; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { flex-shrink: 0; font-family: Cinzel, Palatino, serif; letter-spacing: .08em; text-transform: uppercase; font-size: 10px; }
    .is-ready .st { color: #c5d59a; }
    .is-missing .st { color: #d4a070; }
  </style>
</head>
<body>
  <h1 id="title">Выбор файлов</h1>
  <p class="hint" id="hint"></p>
  <button type="button" id="open">Открыть проводник</button>
  <input id="file" type="file" />
  <p class="status" id="status"></p>
  <div class="need-head">
    <h2>Необходимые объекты</h2>
    <span id="count"></span>
  </div>
  <div id="list"></div>
  <script>
    const origin = window.location.origin;
    const file = document.getElementById("file");
    const list = document.getElementById("list");
    const title = document.getElementById("title");
    const hint = document.getElementById("hint");
    const count = document.getElementById("count");
    const status = document.getElementById("status");
    const openBtn = document.getElementById("open");

    function render(cfg) {
      const mode = cfg && cfg.mode === "gem" ? "gem" : "files";
      title.textContent = mode === "gem" ? "Сцена .gem" : "Файлы сцены";
      hint.textContent = mode === "gem"
        ? "Проводник привязан к этому окну. Вкладку сайта можно открыть рядом — список не закроется."
        : "Можно выбрать все файлы пачкой: сайт оставит только нужные по имени. Окно можно сдвинуть и смотреть список на сайте.";
      file.accept = (cfg && cfg.accept) || "";
      file.multiple = mode !== "gem";
      const items = (cfg && cfg.items) || [];
      const missing = items.filter(function (item) { return !item.ready; }).length;
      count.textContent = items.length ? (items.length - missing) + " из " + items.length : "";
      list.textContent = "";
      if (!items.length) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = mode === "gem" ? "Выберите файл сцены .gem." : "Дополнительных файлов не требуется.";
        list.appendChild(p);
        return;
      }
      const groups = new Map();
      items.forEach(function (item) {
        const folder = item.folder || ".";
        if (!groups.has(folder)) groups.set(folder, []);
        groups.get(folder).push(item);
      });
      groups.forEach(function (rows, folder) {
        const wrap = document.createElement("div");
        wrap.className = "group";
        const h = document.createElement("h3");
        h.textContent = folder;
        wrap.appendChild(h);
        const ul = document.createElement("ul");
        rows.forEach(function (item) {
          const li = document.createElement("li");
          li.className = item.ready ? "is-ready" : "is-missing";
          const name = document.createElement("span");
          name.className = "name";
          name.textContent = item.name;
          const st = document.createElement("span");
          st.className = "st";
          st.textContent = item.ready ? "есть" : "нужен";
          li.appendChild(name);
          li.appendChild(st);
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        list.appendChild(wrap);
      });
    }

    function sendFiles() {
      if (!file.files || !file.files.length || !window.opener || window.opener.closed) return;
      const files = Array.from(file.files);
      const names = files.map(function (item) { return item.name; }).join(", ");
      try {
        window.opener.postMessage({ type: "kristal-scene-files", files: files }, origin);
        status.textContent = "Передано: " + names;
        file.value = "";
      } catch (err) {
        Promise.all(files.map(function (item) {
          return item.arrayBuffer().then(function (buf) {
            return { name: item.name, type: item.type, lastModified: item.lastModified, buffer: buf };
          });
        })).then(function (payload) {
          window.opener.postMessage({ type: "kristal-scene-files-buf", files: payload }, origin);
          status.textContent = "Передано: " + names;
          file.value = "";
        });
      }
    }

    openBtn.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", sendFiles);
    window.addEventListener("message", function (ev) {
      if (ev.origin !== origin) return;
      if (ev.data && ev.data.type === "kristal-scene-config") render(ev.data);
    });
    window.kristalApply = render;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "kristal-picker-ready" }, origin);
    }
  </script>
</body>
</html>`;
}

function serializeItems(needed, assigned) {
  return (needed || []).map((item) => ({
    rel: item.rel,
    name: item.name,
    folder: item.folder,
    ready: Boolean(assigned && assigned[item.rel]),
  }));
}

export function openScenePickerWindow({ mode, accept, needed, assigned }) {
  const popup = window.open("", PICKER_NAME, FEATURES);
  if (!popup) {
    return null;
  }
  const fresh = !popup.document.getElementById("file");
  if (fresh) {
    popup.document.open();
    popup.document.write(pickerHtml());
    popup.document.close();
  }
  const config = {
    type: "kristal-scene-config",
    mode: mode === "gem" ? "gem" : "files",
    accept: accept || "",
    items: serializeItems(needed, assigned),
  };
  const input = popup.document.getElementById("file");
  if (input) {
    input.accept = config.accept;
    input.multiple = config.mode !== "gem";
  }
  if (typeof popup.kristalApply === "function") {
    popup.kristalApply(config);
  } else {
    setTimeout(() => {
      if (typeof popup.kristalApply === "function") {
        popup.kristalApply(config);
      } else if (!popup.closed) {
        popup.postMessage(config, window.location.origin);
      }
    }, 40);
  }
  if (input) {
    try {
      input.click();
    } catch {
      /* ignore */
    }
  }
  try {
    popup.focus();
  } catch {
    /* ignore */
  }
  return popup;
}

export function syncScenePickerWindow(popup, { mode, accept, needed, assigned }) {
  if (!popup || popup.closed) {
    return;
  }
  const config = {
    type: "kristal-scene-config",
    mode: mode === "gem" ? "gem" : "files",
    accept: accept || "",
    items: serializeItems(needed, assigned),
  };
  if (typeof popup.kristalApply === "function") {
    popup.kristalApply(config);
  } else {
    popup.postMessage(config, window.location.origin);
  }
}

export function closeScenePickerWindow(popup) {
  if (popup && !popup.closed) {
    try {
      popup.close();
    } catch {
      /* ignore */
    }
  }
}
