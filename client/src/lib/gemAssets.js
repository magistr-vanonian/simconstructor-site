const ASSET_EXT = new Set([
  ".cmf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tga",
  ".gif",
  ".ttf",
  ".otf",
  ".json",
  ".dds",
  ".lua",
  ".hdr",
  ".exr",
  ".vfx",
]);

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tga", ".gif", ".dds", ".hdr", ".exr"]);
const FONT_EXT = new Set([".ttf", ".otf"]);
const ASSET_ROOTS = [
  "meshes",
  "textures",
  "fonts",
  "maps",
  "landscapes",
  "landscapewithmap",
  "simulations",
  "prefabs",
  "scenes",
  "vfx",
  "scripts",
];
const SKIP_KEYS = new Set(["name", "type", "text", "id"]);
const IMPORTED_PREFIXES = ["meshes/imported/", "textures/imported/"];
const TAG_PREFIX_RE = /^[A-Za-z][A-Za-z0-9_-]{1,40}:/;
const PATH_RE =
  /(?:(?:[A-Za-z]:)?(?:[\\/]?(?:Assets|Meshes|Textures|Fonts|Maps|Landscapes|LandscapeWithMap|Simulations|Prefabs|Scenes|Vfx|Scripts))[\\/][^\n"<>|:]+?\.(?:cmf|png|jpe?g|webp|bmp|tga|gif|ttf|otf|json|dds|lua|hdr|exr|vfx|gem)|[A-Za-z0-9_./'\\-]+\.(?:cmf|png|jpe?g|webp|bmp|tga|gif|ttf|otf|json|dds|lua|hdr|exr|vfx|gem))/gi;

const SKIP_PREFIXES = [
  "meshes/unitcube.cmf",
  "meshes/trees/",
  "textures/trees/",
  "textures/foliage/",
  "engine-res/",
  "res/",
];

function extOf(name) {
  const base = String(name || "");
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export function normalizeAssetPath(raw) {
  let s = String(raw || "")
    .trim()
    .replace(/\\/g, "/");
  if (!s) {
    return "";
  }
  s = s.replace(/^["']|["']$/g, "");
  s = s.replace(/^[a-zA-Z]:/, "");
  while (s.startsWith("/")) {
    s = s.slice(1);
  }

  const lower = s.toLowerCase();
  const token = "/assets/";
  const idx = lower.lastIndexOf(token);
  if (idx >= 0) {
    s = s.slice(idx + token.length);
  } else if (lower.startsWith("assets/")) {
    s = s.slice("assets/".length);
  } else {
    const parts = s.split("/");
    const rootAt = parts.findIndex((part) => ASSET_ROOTS.includes(part.toLowerCase()));
    if (rootAt > 0) {
      s = parts.slice(rootAt).join("/");
    }
  }

  return s
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

export function inferFolderForName(name) {
  const ext = extOf(name);
  if (ext === ".cmf") {
    return "Meshes/Imported";
  }
  if (FONT_EXT.has(ext)) {
    return "Fonts";
  }
  if (IMAGE_EXT.has(ext)) {
    return "Textures/Imported";
  }
  if (ext === ".gem" || ext === ".json" || ext === ".lua") {
    return "Simulations";
  }
  if (ext === ".vfx") {
    return "Vfx";
  }
  return "Imported";
}

function shouldSkip(rel) {
  const lower = String(rel || "").toLowerCase();
  if (!lower || lower.length > 260) {
    return true;
  }
  return SKIP_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(prefix));
}

function looksLikeAsset(rel) {
  if (!rel || shouldSkip(rel)) {
    return false;
  }
  const ext = extOf(rel);
  if (ext === ".gem") {
    return false;
  }
  return ASSET_EXT.has(ext);
}

function finalizeRel(rel) {
  const normalized = normalizeAssetPath(rel);
  if (!looksLikeAsset(normalized) || !normalized.includes("/")) {
    return "";
  }
  return normalized;
}

function preferSpecificFolders(rels) {
  const grouped = new Map();
  for (const rel of rels) {
    const name = rel.split("/").pop().toLowerCase();
    if (!grouped.has(name)) {
      grouped.set(name, []);
    }
    grouped.get(name).push(rel);
  }
  const out = [];
  for (const group of grouped.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const specific = group.filter((rel) => {
      const lower = rel.toLowerCase();
      return !IMPORTED_PREFIXES.some((prefix) => lower.startsWith(prefix));
    });
    out.push(...(specific.length ? specific : group));
  }
  return out;
}

function stripTagPrefix(raw) {
  return String(raw || "").replace(TAG_PREFIX_RE, "");
}

function addPath(raw, bag) {
  const rel = finalizeRel(stripTagPrefix(raw));
  if (!rel) {
    return;
  }
  bag.set(rel.toLowerCase(), rel);
}

function harvestFromString(value, bag) {
  const text = String(value || "").trim();
  if (!text) {
    return;
  }
  const lowerText = text.toLowerCase();
  if (lowerText.startsWith("http://") || lowerText.startsWith("https://") || lowerText.startsWith("data:") || lowerText.startsWith("file:")) {
    return;
  }
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      walkValue(JSON.parse(text), bag);
      return;
    } catch {
      if (text.length > 20000) {
        return;
      }
    }
  }
  if (text.length > 20000) {
    return;
  }

  const colon = text.indexOf(":");
  if (colon > 1 && colon < 48) {
    addPath(text.slice(colon + 1), bag);
  }
  addPath(text, bag);

  PATH_RE.lastIndex = 0;
  let match;
  while ((match = PATH_RE.exec(text))) {
    addPath(match[0], bag);
  }
}

function walkValue(node, bag, key) {
  if (node == null) {
    return;
  }
  if (typeof node === "string") {
    if (SKIP_KEYS.has(key) && !/[\\/]/.test(node)) {
      return;
    }
    harvestFromString(node, bag);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walkValue(item, bag, key);
    }
    return;
  }
  if (typeof node === "object") {
    for (const [childKey, value] of Object.entries(node)) {
      walkValue(value, bag, childKey);
    }
  }
}

export function extractGemAssets(data) {
  const root = typeof data === "string" ? JSON.parse(data.replace(/^\uFEFF/, "")) : data;
  const bag = new Map();
  walkValue(root, bag);
  return preferSpecificFolders([...bag.values()])
    .map((rel) => {
      const name = rel.split("/").pop();
      const folder = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : inferFolderForName(name);
      return { rel, name, folder };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel, "ru"));
}

export function inferDest(file) {
  const hint = String(file && (file._rel || file.webkitRelativePath || file.name) || "").replace(/\\/g, "/");
  const normalized = normalizeAssetPath(hint);
  if (normalized.includes("/") && looksLikeAsset(normalized)) {
    return normalized;
  }
  const name = (file && file.name) || hint.split("/").pop() || "file";
  return `${inferFolderForName(name)}/${name}`;
}

export function fileNeededByName(file, needed) {
  const name = String(file && file.name ? file.name : "").toLowerCase();
  if (!name || !needed || !needed.length) {
    return false;
  }
  const hint = normalizeAssetPath(file._rel || file.webkitRelativePath || file.name).toLowerCase();
  return needed.some((item) => {
    const itemName = String(item.name || "").toLowerCase();
    const itemRel = String(item.rel || "").toLowerCase();
    if (name === itemName) {
      return true;
    }
    return Boolean(hint && (hint === itemRel || hint.endsWith(`/${itemRel}`)));
  });
}

export function filterNeededFiles(files, needed) {
  const kept = [];
  const skipped = [];
  for (const file of files || []) {
    if (fileNeededByName(file, needed)) {
      kept.push(file);
    } else {
      skipped.push(file);
    }
  }
  return { kept, skipped };
}

export function matchIncomingFiles(needed, files, previous = {}) {
  const assigned = { ...previous };

  function remaining() {
    return needed.filter((item) => !assigned[item.rel]);
  }

  function tryAssign(file, relHint) {
    const name = String(file.name || "").toLowerCase();
    const hint = normalizeAssetPath(relHint) || String(relHint || "").replace(/\\/g, "/");
    const rest = remaining();
    const exact = rest.find(
      (item) => item.rel.toLowerCase() === hint.toLowerCase() || item.rel.toLowerCase() === String(relHint || "").replace(/\\/g, "/").toLowerCase()
    );
    if (exact) {
      assigned[exact.rel] = file;
      return true;
    }
    const byName = rest.filter((item) => item.name.toLowerCase() === name);
    if (!byName.length) {
      return false;
    }
    const hinted = byName.filter(
      (item) =>
        hint.toLowerCase().includes(item.folder.toLowerCase()) || hint.toLowerCase().endsWith(item.rel.toLowerCase())
    );
    const targets = hinted.length ? hinted : byName;
    for (const item of targets) {
      assigned[item.rel] = file;
    }
    return true;
  }

  for (const file of files) {
    const hint = file._rel || file.webkitRelativePath || file.name;
    if (tryAssign(file, hint)) {
      continue;
    }
    const dest = inferDest(file);
    const leftover = remaining().find((item) => item.rel.toLowerCase() === dest.toLowerCase());
    if (leftover) {
      assigned[leftover.rel] = file;
    }
  }

  return { assigned, extras: [] };
}

export function groupByFolder(items) {
  const map = new Map();
  for (const item of items) {
    const folder = item.folder || ".";
    if (!map.has(folder)) {
      map.set(folder, []);
    }
    map.get(folder).push(item);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
}

export async function collectDroppedFiles(dataTransfer) {
  const out = [];
  const items = dataTransfer && dataTransfer.items;
  if (items && items.length) {
    const jobs = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        jobs.push(walkEntry(entry, "", out));
      } else if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          out.push(file);
        }
      }
    }
    await Promise.all(jobs);
    if (out.length) {
      return out;
    }
  }
  return Array.from((dataTransfer && dataTransfer.files) || []);
}

function readAllEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const pump = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all);
          return;
        }
        all.push(...batch);
        pump();
      }, reject);
    };
    pump();
  });
}

async function walkEntry(entry, prefix, out) {
  if (!entry) {
    return;
  }
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    const rel = prefix ? `${prefix}/${file.name}` : file.name;
    file._rel = rel;
    out.push(file);
    return;
  }
  if (entry.isDirectory) {
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const children = await readAllEntries(entry.createReader());
    for (const child of children) {
      await walkEntry(child, nextPrefix, out);
    }
  }
}
