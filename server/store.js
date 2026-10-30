"use strict";

const fs = require("fs");
const path = require("path");

const CATEGORIES = [
  "scenes",
  "simulations",
  "landscapes",
  "figures",
  "fonts",
  "textures",
];

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeName(name) {
  const base = path.basename(String(name || "file")).replace(/[<>:"|?*\u0000-\u001f]/g, "_");
  const trimmed = base.replace(/^\.+/, "").trim();
  return trimmed || "file";
}

function slugPart(name) {
  const parsed = path.parse(sanitizeName(name));
  const raw = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return raw || "item";
}

function makeId(hint) {
  return `${Date.now().toString(36)}-${slugPart(hint)}`;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function walkFiles(root) {
  const out = [];
  if (!fs.existsSync(root)) {
    return out;
  }
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name !== "meta.json" && entry.name !== ".gitkeep") {
        out.push(full);
      }
    }
  }
  return out;
}

function relPosix(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

function pickThumb(category, itemDir, files) {
  if (category === "scenes") {
    return null;
  }
  const images = files.filter((file) => IMAGE_EXT.has(path.extname(file).toLowerCase()));
  if (!images.length) {
    return null;
  }
  const preferred = images.find((file) => /thumb|atlas|preview|preview/i.test(path.basename(file))) || images[0];
  return relPosix(itemDir, preferred);
}

function firstVideo(dir) {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const names = fs.readdirSync(dir);
  const hit = names.find((name) => VIDEO_EXT.has(path.extname(name).toLowerCase()));
  return hit ? path.join(dir, hit) : null;
}

function createLocalStore(opts) {
  const storageRoot = opts.storageRoot;
  const contentRoot = opts.contentRoot;
  const brandIcon = opts.brandIcon;
  const constructorDir = path.join(storageRoot, "constructor");
  const libraryRoot = path.join(storageRoot, "library");

  ensureDir(constructorDir);
  for (const cat of CATEGORIES) {
    ensureDir(path.join(libraryRoot, cat));
  }

  function constructorZipPath() {
    return path.join(constructorDir, "SimConstructor-Release.zip");
  }

  function constructorMetaPath() {
    return path.join(constructorDir, "meta.json");
  }

  function getConstructor() {
    const zip = constructorZipPath();
    const meta = readJson(constructorMetaPath()) || {};
    if (!fs.existsSync(zip)) {
      return { available: false, filename: "SimConstructor-Release.zip", ...meta };
    }
    const stat = fs.statSync(zip);
    return {
      available: true,
      filename: "SimConstructor-Release.zip",
      size: stat.size,
      updatedAt: (meta.updatedAt && String(meta.updatedAt)) || stat.mtime.toISOString(),
      source: meta.source || "local",
    };
  }

  function publishConstructor(srcZip, extraMeta) {
    ensureDir(constructorDir);
    const dest = constructorZipPath();
    if (path.resolve(srcZip) !== path.resolve(dest)) {
      fs.copyFileSync(srcZip, dest);
    }
    const stat = fs.statSync(dest);
    const meta = {
      filename: "SimConstructor-Release.zip",
      size: stat.size,
      updatedAt: new Date().toISOString(),
      source: extraMeta && extraMeta.source ? extraMeta.source : "publish-script",
    };
    writeJson(constructorMetaPath(), meta);
    return getConstructor();
  }

  function listLibrary(category) {
    if (!CATEGORIES.includes(category)) {
      return [];
    }
    const dir = path.join(libraryRoot, category);
    ensureDir(dir);
    const items = [];
    for (const name of fs.readdirSync(dir)) {
      const itemDir = path.join(dir, name);
      if (!fs.statSync(itemDir).isDirectory()) {
        continue;
      }
      const files = walkFiles(itemDir);
      if (!files.length && !fs.existsSync(path.join(itemDir, "meta.json"))) {
        continue;
      }
      let meta = readJson(path.join(itemDir, "meta.json"));
      if (!meta) {
        const original = files[0] ? path.basename(files[0]) : name;
        meta = {
          id: name,
          name: original,
          originalName: original,
          files: files.map((file) => relPosix(itemDir, file)),
          size: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
          createdAt: fs.statSync(itemDir).mtime.toISOString(),
          thumb: pickThumb(category, itemDir, files),
        };
        writeJson(path.join(itemDir, "meta.json"), meta);
      }
      items.push({
        id: name,
        name: meta.name || name,
        originalName: meta.originalName || meta.name || name,
        size: meta.size || 0,
        createdAt: meta.createdAt,
        hasThumb: category === "scenes" ? true : Boolean(meta.thumb),
        fileCount: (meta.files && meta.files.length) || files.length,
      });
    }
    items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return items;
  }

  function itemDir(category, id) {
    if (!CATEGORIES.includes(category)) {
      return null;
    }
    const safeId = sanitizeName(id);
    const root = path.resolve(libraryRoot, category);
    const dir = path.resolve(root, safeId);
    if (dir !== root && !dir.startsWith(root + path.sep)) {
      return null;
    }
    return fs.existsSync(dir) ? dir : null;
  }

  function readMeta(category, id) {
    const dir = itemDir(category, id);
    if (!dir) {
      return null;
    }
    return readJson(path.join(dir, "meta.json"));
  }

  function resolveThumb(category, id) {
    if (category === "scenes") {
      return brandIcon;
    }
    const dir = itemDir(category, id);
    if (!dir) {
      return brandIcon;
    }
    const meta = readJson(path.join(dir, "meta.json")) || {};
    if (meta.thumb) {
      const full = path.join(dir, meta.thumb);
      if (fs.existsSync(full)) {
        return full;
      }
    }
    const files = walkFiles(dir);
    const picked = pickThumb(category, dir, files);
    if (picked) {
      const full = path.join(dir, picked);
      if (fs.existsSync(full)) {
        return full;
      }
    }
    return brandIcon;
  }

  function packDownload(category, id) {
    const dir = itemDir(category, id);
    if (!dir) {
      return null;
    }
    const meta = readJson(path.join(dir, "meta.json")) || {};
    const files = walkFiles(dir).filter((file) => path.basename(file) !== "meta.json");
    if (files.length === 1) {
      return { kind: "file", file: files[0], downloadName: meta.originalName || path.basename(files[0]) };
    }
    return { kind: "folder", dir, downloadName: `${meta.name || id}.zip`, files };
  }

  function finalizeUpload(category, id, itemPath, originalNames) {
    const files = walkFiles(itemPath);
    const size = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    const display = (originalNames && originalNames[0]) || (files[0] && path.basename(files[0])) || id;
    const meta = {
      id,
      name: path.parse(display).name || display,
      originalName: display,
      files: files.map((file) => relPosix(itemPath, file)),
      size,
      createdAt: new Date().toISOString(),
      thumb: pickThumb(category, itemPath, files),
    };
    writeJson(path.join(itemPath, "meta.json"), meta);
    return meta;
  }

  return {
    CATEGORIES,
    constructorZipPath,
    getConstructor,
    publishConstructor,
    listLibrary,
    itemDir,
    readMeta,
    resolveThumb,
    packDownload,
    finalizeUpload,
    makeId,
    sanitizeName,
    firstVideo,
    walkFiles,
    libraryRoot,
    contentRoot,
    brandIcon,
  };
}

module.exports = {
  CATEGORIES,
  createLocalStore,
};
