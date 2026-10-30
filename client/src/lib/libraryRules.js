const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tga"]);
const FONT_EXT = new Set([".ttf", ".otf"]);
const JUNK = new Set(["thumbs.db", "desktop.ini", ".ds_store", ".gitkeep", "meta.json"]);

function fileName(rel) {
  const parts = String(rel || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function extOf(rel) {
  const name = fileName(rel);
  const at = name.lastIndexOf(".");
  return at >= 0 ? name.slice(at).toLowerCase() : "";
}

function isJunk(rel) {
  return JUNK.has(fileName(rel).toLowerCase());
}

function isKristalBuildManifest(text) {
  try {
    const data = JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
    if (!data || typeof data !== "object") {
      return false;
    }
    const scene = String(data.entryScene || "");
    const target = String(data.target || "").toLowerCase();
    return scene.toLowerCase().includes("main.gem") || target === "windows-x64" || Number(data.formatVersion) >= 1;
  } catch {
    return false;
  }
}

export function validateLibraryFiles(category, files) {
  const list = (files || [])
    .map((file) => {
      const rel = String((file && (file.rel || file.name)) || "").replace(/\\/g, "/");
      return {
        rel,
        name: fileName(rel),
        text: file && file.text,
      };
    })
    .filter((file) => file.name && !isJunk(file.name));

  if (category === "scenes") {
    return null;
  }

  if (category === "simulations") {
    const warn = "Загрузите настоящую симуляцию.";
    const manifest = list.find((file) => file.name.toLowerCase() === "kristal.build.json");
    if (!manifest) {
      return warn;
    }
    if (manifest.text && !isKristalBuildManifest(manifest.text)) {
      return warn;
    }
    if (!list.some((file) => extOf(file.name) === ".exe")) {
      return warn;
    }
    return null;
  }

  if (category === "landscapes") {
    if (!list.some((file) => extOf(file.name) === ".cmf")) {
      return "В ландшафте должен быть файл .cmf.";
    }
    return null;
  }

  if (category === "figures") {
    if (!list.some((file) => extOf(file.name) === ".cmf")) {
      return "Нужна готовая фигурка .cmf, скомпилированная через конвертер конструктора.";
    }
    return null;
  }

  if (category === "fonts") {
    if (!list.length || list.some((file) => !FONT_EXT.has(extOf(file.name)))) {
      return "Загружайте только шрифты .ttf или .otf.";
    }
    return null;
  }

  if (category === "textures") {
    if (!list.length || list.some((file) => !IMAGE_EXT.has(extOf(file.name)))) {
      return "Загружайте только текстуры: png, jpg, jpeg, webp, bmp, tga, gif.";
    }
    return null;
  }

  return null;
}
