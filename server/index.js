"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mime = require("mime-types");
const archiver = require("archiver");
const { createLocalStore, CATEGORIES } = require("./store");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const PUBLISH_TOKEN = process.env.PUBLISH_TOKEN || "kristal-demo-publish";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "";

const brandIcon = [
  path.join(ROOT, "client", "public", "source_icon.png"),
  path.join(ROOT, "storage", "brand-source_icon.png"),
].find((file) => fs.existsSync(file));

const store = createLocalStore({
  storageRoot: path.join(ROOT, "storage"),
  contentRoot: path.join(ROOT, "content"),
  brandIcon,
});

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "4mb" }));

function contentDisposition(name) {
  const ascii = String(name || "download").replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

fs.mkdirSync(path.join(ROOT, "storage", "constructor", "_incoming"), { recursive: true });

app.use("/brand", express.static(path.join(ROOT, "client", "public")));
app.use("/media/videos", express.static(path.join(ROOT, "content", "videos")));

function tokenOk(req) {
  const header = String(req.headers.authorization || "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = String(req.query.token || "");
  const body = req.body && req.body.token ? String(req.body.token) : "";
  const sent = bearer || query || body || String(req.headers["x-publish-token"] || "");
  return sent && sent === PUBLISH_TOKEN;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, driver: "local", origin: PUBLIC_ORIGIN || null });
});

app.get("/api/guide", (_req, res) => {
  const file = path.join(ROOT, "content", "instructions.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Не удалось прочитать шаблон инструкции", detail: String(err.message) });
  }
});

app.get("/api/guide/video/:slot", (req, res) => {
  const slot = String(req.params.slot || "").replace(/[^\d]/g, "").padStart(2, "0");
  if (!slot) {
    return res.json({ exists: false });
  }
  const dir = path.join(ROOT, "content", "videos", slot);
  const file = store.firstVideo(dir);
  if (!file) {
    return res.json({ exists: false, slot, dir: `content/videos/${slot}` });
  }
  res.json({
    exists: true,
    slot,
    url: `/media/videos/${slot}/${encodeURIComponent(path.basename(file))}`,
    filename: path.basename(file),
  });
});

app.get("/api/constructor", (_req, res) => {
  res.json(store.getConstructor());
});

app.get("/api/constructor/download", (req, res) => {
  const info = store.getConstructor();
  if (!info.available) {
    return res.status(404).json({
      error: "Релиз ещё не опубликован. Запустите publish-simconstructor-release.cmd в корне Kristal_Engine.",
    });
  }
  const zip = store.constructorZipPath();
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", contentDisposition(info.filename));
  res.sendFile(zip);
});

const constructorUpload = multer({
  dest: path.join(ROOT, "storage", "constructor", "_incoming"),
  limits: { fileSize: 20 * 1024 * 1024 * 1024 },
});

app.post("/api/constructor/publish", (req, res) => {
  if (!tokenOk(req)) {
    return res.status(401).json({ error: "Нужен PUBLISH_TOKEN" });
  }
  const src = req.body && req.body.localPath;
  if (!src || !fs.existsSync(src)) {
    return res.status(400).json({ error: "Нет файла релиза" });
  }
  try {
    res.json(store.publishConstructor(src, { source: "local-path" }));
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

app.post("/api/constructor", constructorUpload.single("file"), (req, res) => {
  if (!tokenOk(req)) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    return res.status(401).json({ error: "Нужен PUBLISH_TOKEN" });
  }
  const src = req.file ? req.file.path : req.body && req.body.localPath;
  if (!src || !fs.existsSync(src)) {
    return res.status(400).json({ error: "Нет файла релиза" });
  }
  try {
    const info = store.publishConstructor(src, { source: req.file ? "upload" : "local-path" });
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

app.get("/api/library", (_req, res) => {
  const out = {};
  for (const cat of CATEGORIES) {
    out[cat] = store.listLibrary(cat);
  }
  res.json({ categories: CATEGORIES, items: out });
});

app.get("/api/library/:category", (req, res) => {
  const category = req.params.category;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "Неизвестная полка" });
  }
  res.json({ category, items: store.listLibrary(category) });
});

app.get("/api/library/:category/:id/thumb", (req, res) => {
  const file = store.resolveThumb(req.params.category, req.params.id);
  if (!file || !fs.existsSync(file)) {
    return res.status(404).end();
  }
  res.setHeader("Cache-Control", "public, max-age=120");
  res.type(mime.lookup(file) || "image/png");
  fs.createReadStream(file).pipe(res);
});

app.get("/api/library/:category/:id/download", (req, res) => {
  const packed = store.packDownload(req.params.category, req.params.id);
  if (!packed) {
    return res.status(404).json({ error: "Объект не найден" });
  }
  if (packed.kind === "file") {
    return res.download(packed.file, packed.downloadName);
  }
  const zipName = packed.downloadName.replace(/[<>:"|?*]/g, "_");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", contentDisposition(zipName));
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err.message) });
    } else {
      res.destroy(err);
    }
  });
  archive.pipe(res);
  for (const file of packed.files) {
    archive.file(file, { name: path.relative(packed.dir, file) });
  }
  archive.finalize();
});

function libraryMulter(req, res, next) {
  const category = req.params.category;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "Неизвестная полка" });
  }
  const hint = req.query.name || `item-${Date.now()}`;
  req.itemId = store.makeId(hint);
  req.itemDir = path.join(store.libraryRoot, category, req.itemId);
  fs.mkdirSync(req.itemDir, { recursive: true });

  const disk = multer.diskStorage({
    destination: (fileReq, file, cb) => {
      const rel = String(file.webkitRelativePath || file.originalname || "").replace(/\\/g, "/");
      const parts = rel.split("/").map((part) => store.sanitizeName(part)).filter(Boolean);
      parts.pop();
      const dest = parts.length ? path.join(fileReq.itemDir, ...parts) : fileReq.itemDir;
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_fileReq, file, cb) => {
      cb(null, store.sanitizeName(file.originalname));
    },
  });
  const upload = multer({
    storage: disk,
    limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 400 },
  }).any();
  upload(req, res, next);
}

app.post("/api/library/:category", libraryMulter, (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      try {
        fs.rmSync(req.itemDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return res.status(400).json({ error: "Файлы не получены" });
    }
    const names = files.map((file) => file.originalname);
    const meta = store.finalizeUpload(req.params.category, req.itemId, req.itemDir, names);
    res.json({ ok: true, item: meta });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

const clientDist = path.join(ROOT, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/media") || req.path.startsWith("/brand")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = app.listen(PORT, () => {
  console.log(`SimConstructor site API http://127.0.0.1:${PORT}`);
  console.log(`storage: ${path.join(ROOT, "storage")}  (local stand-in for cloud)`);
});
server.timeout = 0;
server.headersTimeout = 0;
