"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SafeAttachmentTrashPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/modals.ts
var import_obsidian2 = require("obsidian");

// src/utils.ts
var import_obsidian = require("obsidian");
var TRASH_ROOT = (0, import_obsidian.normalizePath)(".safe-attachment-trash");
var TRASH_FILES = (0, import_obsidian.normalizePath)(`${TRASH_ROOT}/files`);
var TRASH_META = (0, import_obsidian.normalizePath)(`${TRASH_ROOT}/meta`);
var TRASH_INDEX = (0, import_obsidian.normalizePath)(`${TRASH_ROOT}/index.json`);
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}
function formatDate(timestamp, locale = "en-US") {
  if (!timestamp) return "\u2014";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  } catch (e) {
    return new Date(timestamp).toLocaleString();
  }
}
function parseCsvList(value) {
  return value.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);
}
function extensionSet(value) {
  return new Set(parseCsvList(value).map((ext) => ext.replace(/^\./, "").toLowerCase()));
}
function pathIsInside(path, folder) {
  const normalizedPath = (0, import_obsidian.normalizePath)(path);
  const normalizedFolder = (0, import_obsidian.normalizePath)(folder).replace(/\/$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}
function sanitizeStoredName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 160) || "file";
}
function mimeForExtension(extension) {
  var _a;
  const ext = extension.toLowerCase();
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    avif: "image/avif",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/mp4",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    xml: "application/xml",
    log: "text/plain",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript"
  };
  return (_a = map[ext]) != null ? _a : "application/octet-stream";
}
function isTextExtension(extension) {
  return (/* @__PURE__ */ new Set(["txt", "md", "csv", "json", "yaml", "yml", "xml", "log", "css", "js", "ts"])).has(extension.toLowerCase());
}
function isImageExtension(extension) {
  return (/* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"])).has(extension.toLowerCase());
}
function isAudioExtension(extension) {
  return (/* @__PURE__ */ new Set(["mp3", "wav", "ogg", "m4a", "flac"])).has(extension.toLowerCase());
}
function isVideoExtension(extension) {
  return (/* @__PURE__ */ new Set(["mp4", "webm", "mov", "m4v"])).has(extension.toLowerCase());
}
async function ensureAdapterFolder(adapter, folderPath) {
  const parts = (0, import_obsidian.normalizePath)(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!await adapter.exists(current)) {
      await adapter.mkdir(current);
    }
  }
}
function uniqueId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

// src/modals.ts
var ConfirmModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, titleText, message, confirmText, dangerous, onConfirm) {
    super(app);
    this.plugin = plugin;
    this.titleText = titleText;
    this.message = message;
    this.confirmText = confirmText;
    this.dangerous = dangerous;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.modalEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    this.setTitle(this.titleText);
    const body = this.contentEl.createDiv({ cls: "sat-confirm-message" });
    body.setText(this.message);
    const actions = this.contentEl.createDiv({ cls: "sat-modal-actions" });
    const cancel = actions.createEl("button", { text: this.plugin.t("cancel") });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: this.confirmText, cls: this.dangerous ? "mod-warning" : "mod-cta" });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this.onConfirm();
        this.close();
      } catch (error) {
        new import_obsidian2.Notice(this.plugin.t("error", { error: error instanceof Error ? error.message : String(error) }));
        confirm.disabled = false;
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ScanReviewModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, candidates, onMove, onClosed) {
    super(app);
    this.plugin = plugin;
    this.candidates = candidates;
    this.onMove = onMove;
    this.onClosed = onClosed;
    this.selected = /* @__PURE__ */ new Set();
    for (const candidate of candidates) this.selected.add(candidate.path);
  }
  onOpen() {
    this.modalEl.addClass("sat-scan-modal");
    this.modalEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    this.setTitle(this.plugin.t("unusedFilesTitle", { count: this.candidates.length }));
    this.render();
  }
  render() {
    this.contentEl.empty();
    this.contentEl.createDiv({ text: this.plugin.t("unusedHelp"), cls: "sat-help" });
    const controls = this.contentEl.createDiv({ cls: "sat-scan-controls" });
    const selectAllLabel = controls.createEl("label", { cls: "sat-select-all" });
    const selectAll = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.createSpan({ text: this.plugin.t("selectAll") });
    const list = this.contentEl.createDiv({ cls: "sat-scan-list" });
    const checkboxes = /* @__PURE__ */ new Map();
    for (const candidate of this.candidates) {
      const row = list.createDiv({ cls: "sat-scan-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selected.has(candidate.path);
      checkboxes.set(candidate.path, checkbox);
      const details = row.createDiv({ cls: "sat-scan-details" });
      details.createDiv({ text: candidate.name, cls: "sat-file-name" });
      details.createDiv({ text: candidate.path, cls: "sat-file-path" });
      row.createDiv({ text: formatBytes(candidate.size), cls: "sat-file-size" });
    }
    const actions = this.contentEl.createDiv({ cls: "sat-modal-actions" });
    const cancel = actions.createEl("button", { text: this.plugin.t("cancel") });
    cancel.addEventListener("click", () => this.close());
    const move = actions.createEl("button", { cls: "mod-cta" });
    const updateControls = () => {
      const allSelected = this.candidates.length > 0 && this.selected.size === this.candidates.length;
      selectAll.checked = allSelected;
      selectAll.indeterminate = this.selected.size > 0 && !allSelected;
      move.setText(this.plugin.t("moveCount", { count: this.selected.size }));
      move.disabled = this.selected.size === 0;
    };
    for (const candidate of this.candidates) {
      const checkbox = checkboxes.get(candidate.path);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(candidate.path);
        else this.selected.delete(candidate.path);
        updateControls();
      });
    }
    selectAll.addEventListener("change", () => {
      if (selectAll.checked) {
        this.selected = new Set(this.candidates.map((item) => item.path));
      } else {
        this.selected.clear();
      }
      for (const [path, checkbox] of checkboxes) checkbox.checked = this.selected.has(path);
      updateControls();
    });
    move.addEventListener("click", async () => {
      move.disabled = true;
      try {
        await this.onMove([...this.selected]);
        this.close();
      } catch (error) {
        new import_obsidian2.Notice(this.plugin.t("error", { error: error instanceof Error ? error.message : String(error) }));
        updateControls();
      }
    });
    updateControls();
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onClosed) == null ? void 0 : _a.call(this);
  }
};

// src/scanner.ts
var import_obsidian3 = require("obsidian");
var UnusedAttachmentScanner = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  async scan() {
    const usedPaths = await this.collectUsedPaths();
    const allowedExtensions = extensionSet(this.settings.extensions);
    const excludedFolders = parseCsvList(this.settings.excludedFolders).map(import_obsidian3.normalizePath);
    const cutoff = Date.now() - Math.max(0, this.settings.minimumAgeHours) * 60 * 60 * 1e3;
    return this.app.vault.getFiles().filter((file) => this.isCandidate(file, allowedExtensions, excludedFolders, usedPaths, cutoff)).map((file) => ({
      path: file.path,
      name: file.name,
      extension: file.extension.toLowerCase(),
      size: file.stat.size,
      mtime: file.stat.mtime
    })).sort((a, b) => a.path.localeCompare(b.path));
  }
  isCandidate(file, allowedExtensions, excludedFolders, usedPaths, cutoff) {
    const ext = file.extension.toLowerCase();
    if (!ext || ext === "md" || ext === "canvas") return false;
    if (!(allowedExtensions.has("*") || allowedExtensions.has(ext))) return false;
    if (excludedFolders.some((folder) => pathIsInside(file.path, folder))) return false;
    if (usedPaths.has((0, import_obsidian3.normalizePath)(file.path))) return false;
    if (file.stat.mtime > cutoff) return false;
    return true;
  }
  async collectUsedPaths() {
    var _a, _b, _c;
    const used = /* @__PURE__ */ new Set();
    const resolved = (_a = this.app.metadataCache.resolvedLinks) != null ? _a : {};
    for (const targets of Object.values(resolved)) {
      for (const [targetPath, count] of Object.entries(targets)) {
        if (count > 0) used.add((0, import_obsidian3.normalizePath)(targetPath));
      }
    }
    for (const note of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(note);
      const refs = [...(_b = cache == null ? void 0 : cache.links) != null ? _b : [], ...(_c = cache == null ? void 0 : cache.embeds) != null ? _c : []];
      for (const ref of refs) {
        const destination = this.app.metadataCache.getFirstLinkpathDest(ref.link, note.path);
        if (destination) used.add((0, import_obsidian3.normalizePath)(destination.path));
      }
    }
    if (this.settings.scanCanvasFiles) {
      const canvases = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "canvas");
      for (const canvas of canvases) {
        try {
          const parsed = JSON.parse(await this.app.vault.cachedRead(canvas));
          this.collectCanvasPaths(parsed, used);
        } catch (e) {
        }
      }
    }
    return used;
  }
  collectCanvasPaths(value, output) {
    if (Array.isArray(value)) {
      for (const child of value) this.collectCanvasPaths(child, output);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "file" && typeof child === "string") {
        output.add((0, import_obsidian3.normalizePath)(child));
      } else {
        this.collectCanvasPaths(child, output);
      }
    }
  }
};

// src/settings.ts
var import_obsidian4 = require("obsidian");
var DEFAULT_SETTINGS = {
  language: "auto",
  extensions: "png, jpg, jpeg, gif, webp, bmp, svg, avif, pdf, mp3, wav, ogg, m4a, flac, mp4, webm, mov, m4v, doc, docx, xls, xlsx, ppt, pptx, zip, rar, 7z, txt, csv",
  excludedFolders: "Templates",
  minimumAgeHours: 0,
  conflictBehavior: "rename",
  scanCanvasFiles: true
};
var SafeTrashSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("sat-settings");
    containerEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsLanguage")).setDesc(this.plugin.t("settingsLanguageDesc")).addDropdown((dropdown) => dropdown.addOption("auto", this.plugin.t("languageAuto")).addOption("fa", this.plugin.t("languagePersian")).addOption("en", this.plugin.t("languageEnglish")).setValue(this.plugin.settings.language).onChange(async (value) => {
      this.plugin.settings.language = value;
      await this.plugin.saveSettings();
      await this.plugin.refreshLanguage();
      this.display();
    }));
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsExtensions")).setDesc(this.plugin.t("settingsExtensionsDesc")).addTextArea((text) => text.setValue(this.plugin.settings.extensions).onChange(async (value) => {
      this.plugin.settings.extensions = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsExcluded")).setDesc(this.plugin.t("settingsExcludedDesc")).addTextArea((text) => text.setValue(this.plugin.settings.excludedFolders).onChange(async (value) => {
      this.plugin.settings.excludedFolders = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsMinAge")).setDesc(this.plugin.t("settingsMinAgeDesc")).addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.minimumAgeHours)).onChange(async (value) => {
      const parsed = Number(value);
      this.plugin.settings.minimumAgeHours = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsConflict")).setDesc(this.plugin.t("settingsConflictDesc")).addDropdown((dropdown) => dropdown.addOption("rename", this.plugin.t("conflictRename")).addOption("skip", this.plugin.t("conflictSkip")).addOption("overwrite", this.plugin.t("conflictOverwrite")).setValue(this.plugin.settings.conflictBehavior).onChange(async (value) => {
      this.plugin.settings.conflictBehavior = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName(this.plugin.t("settingsCanvas")).setDesc(this.plugin.t("settingsCanvasDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.scanCanvasFiles).onChange(async (value) => {
      this.plugin.settings.scanCanvasFiles = value;
      await this.plugin.saveSettings();
    }));
  }
};

// src/store.ts
var import_obsidian5 = require("obsidian");
var SafeTrashStore = class {
  constructor(app, t = (key) => key) {
    this.t = t;
    this.records = [];
    this.app = app;
  }
  async initialize() {
    const adapter = this.app.vault.adapter;
    await ensureAdapterFolder(adapter, TRASH_ROOT);
    await ensureAdapterFolder(adapter, TRASH_FILES);
    await ensureAdapterFolder(adapter, TRASH_META);
    this.records = await this.loadRecords();
    await this.saveIndex();
  }
  list() {
    return [...this.records].sort((a, b) => b.trashedAt - a.trashedAt);
  }
  get(id) {
    return this.records.find((record) => record.id === id);
  }
  async read(record) {
    return this.app.vault.adapter.readBinary(record.storedPath);
  }
  async moveToTrash(file, reason) {
    var _a, _b;
    if (file.path.startsWith(`${TRASH_ROOT}/`)) {
      throw new Error(this.t("alreadyInTrash"));
    }
    const data = await this.app.vault.readBinary(file);
    const id = uniqueId();
    const storedName = `${id}--${sanitizeStoredName(file.name)}`;
    const storedPath = (0, import_obsidian5.normalizePath)(`${TRASH_FILES}/${storedName}`);
    const metadataPath = (0, import_obsidian5.normalizePath)(`${TRASH_META}/${id}.json`);
    const record = {
      id,
      originalPath: file.path,
      storedPath,
      metadataPath,
      fileName: file.name,
      extension: (_b = (_a = file.extension) == null ? void 0 : _a.toLowerCase()) != null ? _b : "",
      size: file.stat.size,
      trashedAt: Date.now(),
      originalMtime: file.stat.mtime,
      reason
    };
    const adapter = this.app.vault.adapter;
    await adapter.writeBinary(storedPath, data);
    await adapter.write(metadataPath, JSON.stringify(record, null, 2));
    try {
      this.records.push(record);
      await this.saveIndex();
      await this.app.vault.delete(file);
      return record;
    } catch (error) {
      this.records = this.records.filter((item) => item.id !== id);
      await this.saveIndex().catch(() => void 0);
      if (await adapter.exists(storedPath)) await adapter.remove(storedPath).catch(() => void 0);
      if (await adapter.exists(metadataPath)) await adapter.remove(metadataPath).catch(() => void 0);
      throw error;
    }
  }
  async restore(record, behavior) {
    const data = await this.read(record);
    const target = await this.resolveRestoreTarget(record.originalPath, behavior);
    if (!target) return null;
    await this.ensureVisibleParent(target);
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing instanceof import_obsidian5.TFolder) {
      throw new Error(this.t("cannotRestoreOverFolder", { path: target }));
    }
    if (existing instanceof import_obsidian5.TFile && behavior === "overwrite") {
      await this.app.vault.modifyBinary(existing, data);
    } else if (!existing) {
      await this.app.vault.createBinary(target, data);
    } else {
      throw new Error(this.t("fileAlreadyExists", { path: target }));
    }
    await this.removeRecordFiles(record);
    return target;
  }
  async restoreAll(behavior) {
    const snapshot = this.list();
    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of snapshot) {
      try {
        const result = await this.restore(record, behavior);
        if (result) restored += 1;
        else skipped += 1;
      } catch (e) {
        failed += 1;
      }
    }
    return { restored, skipped, failed };
  }
  async permanentlyDelete(record) {
    await this.removeRecordFiles(record);
  }
  async empty() {
    const snapshot = this.list();
    let deleted = 0;
    let failed = 0;
    for (const record of snapshot) {
      try {
        await this.removeRecordFiles(record);
        deleted += 1;
      } catch (e) {
        failed += 1;
      }
    }
    return { deleted, failed };
  }
  async resolveRestoreTarget(originalPath, behavior) {
    const normalized = (0, import_obsidian5.normalizePath)(originalPath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (!existing) return normalized;
    if (behavior === "skip") return null;
    if (behavior === "overwrite" && existing instanceof import_obsidian5.TFile) return normalized;
    return this.makeUniquePath(normalized);
  }
  makeUniquePath(originalPath) {
    const slash = originalPath.lastIndexOf("/");
    const folder = slash >= 0 ? originalPath.slice(0, slash + 1) : "";
    const fileName = slash >= 0 ? originalPath.slice(slash + 1) : originalPath;
    const dot = fileName.lastIndexOf(".");
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : "";
    let index = 1;
    const suffix = this.t("restoredSuffix");
    let candidate = `${folder}${base} (${suffix} ${index})${extension}`;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      index += 1;
      candidate = `${folder}${base} (${suffix} ${index})${extension}`;
    }
    return (0, import_obsidian5.normalizePath)(candidate);
  }
  async ensureVisibleParent(filePath) {
    const slash = filePath.lastIndexOf("/");
    if (slash < 0) return;
    const folderPath = filePath.slice(0, slash);
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      } else if (!(existing instanceof import_obsidian5.TFolder)) {
        throw new Error(this.t("cannotCreateFolder", { path: current }));
      }
    }
  }
  async removeRecordFiles(record) {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(record.storedPath)) await adapter.remove(record.storedPath);
    if (await adapter.exists(record.metadataPath)) await adapter.remove(record.metadataPath);
    this.records = this.records.filter((item) => item.id !== record.id);
    await this.saveIndex();
  }
  async loadRecords() {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(TRASH_INDEX)) {
      try {
        const parsed = JSON.parse(await adapter.read(TRASH_INDEX));
        if (Array.isArray(parsed.records)) {
          const valid = [];
          for (const record of parsed.records) {
            if ((record == null ? void 0 : record.id) && (record == null ? void 0 : record.storedPath) && await adapter.exists(record.storedPath)) valid.push(record);
          }
          return valid;
        }
      } catch (e) {
      }
    }
    const recovered = [];
    try {
      const listing = await adapter.list(TRASH_META);
      for (const path of listing.files.filter((item) => item.endsWith(".json"))) {
        try {
          const record = JSON.parse(await adapter.read(path));
          if ((record == null ? void 0 : record.id) && (record == null ? void 0 : record.storedPath) && await adapter.exists(record.storedPath)) recovered.push(record);
        } catch (e) {
        }
      }
    } catch (e) {
      return [];
    }
    return recovered;
  }
  async saveIndex() {
    const index = { version: 1, records: this.records };
    await this.app.vault.adapter.write(TRASH_INDEX, JSON.stringify(index, null, 2));
  }
};

// src/view.ts
var import_obsidian6 = require("obsidian");
var VIEW_TYPE_SAFE_TRASH = "safe-attachment-trash-view";
var SafeTrashView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedIds = /* @__PURE__ */ new Set();
    this.searchQuery = "";
  }
  getViewType() {
    return VIEW_TYPE_SAFE_TRASH;
  }
  getDisplayText() {
    return this.plugin.t("safeTrash");
  }
  getIcon() {
    return "trash-2";
  }
  async onOpen() {
    this.containerEl.addClass("sat-view-root");
    await this.render();
    void this.plugin.scanUnused({ silentWhenEmpty: true });
  }
  async refresh() {
    const available = new Set(this.plugin.store.list().map((item) => item.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => available.has(id)));
    await this.render();
  }
  async render() {
    const content = this.contentEl;
    content.empty();
    content.addClass("sat-view");
    content.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    const header = content.createDiv({ cls: "sat-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h3", { text: this.plugin.t("safeTrash") });
    titleWrap.createDiv({ text: this.plugin.t("subtitle"), cls: "sat-subtitle" });
    const toolbar = content.createDiv({ cls: "sat-toolbar" });
    this.addToolbarButton(toolbar, this.plugin.t("restoreSelected"), "", () => this.restoreSelected());
    this.addToolbarButton(toolbar, this.plugin.t("deleteSelected"), "mod-warning", () => this.deleteSelected());
    this.addToolbarButton(toolbar, this.plugin.t("refresh"), "", () => this.plugin.scanUnused({ silentWhenEmpty: false }));
    const pane = content.createDiv({ cls: "sat-list-pane" });
    const search = pane.createEl("input", {
      type: "search",
      placeholder: this.plugin.t("searchPlaceholder"),
      cls: "sat-search"
    });
    search.value = this.searchQuery;
    const listControls = pane.createDiv({ cls: "sat-list-controls" });
    const summary = listControls.createDiv({ cls: "sat-summary" });
    const selectAllLabel = listControls.createEl("label", { cls: "sat-select-all" });
    const selectAll = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.createSpan({ text: this.plugin.t("selectAll") });
    const listHost = pane.createDiv({ cls: "sat-record-list" });
    const updateSelectionControls = () => {
      const filtered = this.filteredRecords();
      summary.setText(this.plugin.t("shownSelected", {
        shown: filtered.length,
        selected: this.selectedIds.size
      }));
      const selectedVisible = filtered.filter((record) => this.selectedIds.has(record.id)).length;
      selectAll.checked = filtered.length > 0 && selectedVisible === filtered.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < filtered.length;
      selectAll.disabled = filtered.length === 0;
    };
    const renderList = () => {
      const filtered = this.filteredRecords();
      updateSelectionControls();
      listHost.empty();
      if (filtered.length === 0) {
        listHost.createDiv({ text: this.plugin.t("trashEmpty"), cls: "sat-empty" });
        return;
      }
      for (const record of filtered) this.renderRecord(listHost, record, updateSelectionControls);
    };
    search.addEventListener("input", () => {
      this.searchQuery = search.value;
      renderList();
    });
    selectAll.addEventListener("change", () => {
      const filtered = this.filteredRecords();
      if (selectAll.checked) {
        for (const record of filtered) this.selectedIds.add(record.id);
      } else {
        for (const record of filtered) this.selectedIds.delete(record.id);
      }
      renderList();
    });
    renderList();
  }
  filteredRecords() {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    const records = this.plugin.store.list();
    if (!query) return records;
    return records.filter(
      (record) => `${record.fileName} ${record.originalPath} ${record.reason}`.toLocaleLowerCase().includes(query)
    );
  }
  renderRecord(parent, record, onSelectionChange) {
    const row = parent.createDiv({ cls: "sat-record" });
    const select = row.createEl("input", { type: "checkbox", cls: "sat-record-checkbox" });
    select.checked = this.selectedIds.has(record.id);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      if (select.checked) this.selectedIds.add(record.id);
      else this.selectedIds.delete(record.id);
      onSelectionChange();
    });
    const details = row.createDiv({ cls: "sat-record-details" });
    details.createDiv({ text: record.fileName, cls: "sat-file-name" });
    details.createDiv({ text: record.originalPath, cls: "sat-file-path" });
    details.createDiv({
      text: `${formatBytes(record.size)} \u2022 ${formatDate(record.trashedAt, this.plugin.locale)}`,
      cls: "sat-file-meta"
    });
    const actions = row.createDiv({ cls: "sat-record-actions" });
    const restore = actions.createEl("button", { text: this.plugin.t("restore") });
    restore.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.restoreOne(record);
    });
    const remove = actions.createEl("button", { text: this.plugin.t("delete"), cls: "mod-warning" });
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      this.confirmDeleteOne(record);
    });
    row.addEventListener("click", () => void this.plugin.openTrashRecord(record.id));
  }
  addToolbarButton(parent, label, className, onClick) {
    const button = parent.createEl("button", { text: label, cls: className });
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await onClick();
      } finally {
        button.disabled = false;
      }
    });
  }
  async restoreOne(record) {
    try {
      const restoredPath = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
      if (restoredPath) new import_obsidian6.Notice(this.plugin.t("restoreSuccess", { path: restoredPath }));
      else new import_obsidian6.Notice(this.plugin.t("restoreSkipped"));
      await this.plugin.refreshOpenViews();
    } catch (error) {
      new import_obsidian6.Notice(this.plugin.t("restoreFailed", {
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
  async restoreSelected() {
    const records = [...this.selectedIds].map((id) => this.plugin.store.get(id)).filter(Boolean);
    if (records.length === 0) {
      new import_obsidian6.Notice(this.plugin.t("noneSelected"));
      return;
    }
    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of records) {
      try {
        const result = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
        if (result) restored += 1;
        else skipped += 1;
      } catch (e) {
        failed += 1;
      }
    }
    this.selectedIds.clear();
    new import_obsidian6.Notice(this.plugin.t("restoreResult", { restored, skipped, failed }));
    await this.plugin.refreshOpenViews();
  }
  confirmDeleteOne(record) {
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("deleteFileTitle"),
      this.plugin.t("deleteFileMessage", { name: record.fileName }),
      this.plugin.t("deletePermanently"),
      true,
      async () => {
        await this.plugin.store.permanentlyDelete(record);
        new import_obsidian6.Notice(this.plugin.t("fileDeleted"));
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }
  deleteSelected() {
    const records = [...this.selectedIds].map((id) => this.plugin.store.get(id)).filter(Boolean);
    if (records.length === 0) {
      new import_obsidian6.Notice(this.plugin.t("noneSelected"));
      return;
    }
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("deleteSelectedTitle"),
      this.plugin.t("deleteSelectedMessage", { count: records.length }),
      this.plugin.t("deletePermanently"),
      true,
      async () => {
        let deleted = 0;
        let failed = 0;
        for (const record of records) {
          try {
            await this.plugin.store.permanentlyDelete(record);
            deleted += 1;
          } catch (e) {
            failed += 1;
          }
        }
        this.selectedIds.clear();
        new import_obsidian6.Notice(this.plugin.t("deleteResult", { deleted, failed }));
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }
};

// src/preview.ts
var import_obsidian7 = require("obsidian");
var VIEW_TYPE_SAFE_TRASH_PREVIEW = "safe-attachment-trash-preview";
var SafeTrashPreviewView = class extends import_obsidian7.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.recordId = null;
    this.objectUrl = null;
    this.navigation = true;
  }
  getViewType() {
    return VIEW_TYPE_SAFE_TRASH_PREVIEW;
  }
  getDisplayText() {
    var _a;
    const record = this.recordId ? this.plugin.store.get(this.recordId) : void 0;
    return (_a = record == null ? void 0 : record.fileName) != null ? _a : this.plugin.t("safeTrash");
  }
  getIcon() {
    return "file-search";
  }
  getState() {
    return { recordId: this.recordId };
  }
  async setState(state, result) {
    await super.setState(state, result);
    const candidate = state;
    this.recordId = typeof (candidate == null ? void 0 : candidate.recordId) === "string" ? candidate.recordId : null;
    await this.render();
  }
  async onOpen() {
    this.containerEl.addClass("sat-preview-view-root");
    await this.render();
  }
  async onClose() {
    this.releaseObjectUrl();
  }
  async refresh() {
    await this.render();
  }
  async render() {
    this.releaseObjectUrl();
    const content = this.contentEl;
    content.empty();
    content.addClass("sat-file-view");
    content.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    const record = this.recordId ? this.plugin.store.get(this.recordId) : void 0;
    if (!record) {
      const empty = content.createDiv({ cls: "sat-file-view-empty" });
      empty.createEl("h3", { text: this.plugin.t("recordMissingTitle") });
      empty.createDiv({ text: this.plugin.t("recordMissingBody"), cls: "sat-subtitle" });
      return;
    }
    const header = content.createDiv({ cls: "sat-file-view-header" });
    const info = header.createDiv({ cls: "sat-file-view-info" });
    info.createEl("h3", { text: record.fileName });
    info.createDiv({ text: record.originalPath, cls: "sat-file-path" });
    const meta = info.createDiv({ cls: "sat-preview-meta" });
    meta.createDiv({ text: this.plugin.t("size", { value: formatBytes(record.size) }) });
    meta.createDiv({ text: this.plugin.t("movedAt", { value: formatDate(record.trashedAt, this.plugin.locale) }) });
    meta.createDiv({ text: this.plugin.t("reason", { value: record.reason }) });
    const actions = header.createDiv({ cls: "sat-preview-actions" });
    const restore = actions.createEl("button", { text: this.plugin.t("restore"), cls: "mod-cta" });
    restore.addEventListener("click", () => void this.restore(record));
    const remove = actions.createEl("button", { text: this.plugin.t("deletePermanently"), cls: "mod-warning" });
    remove.addEventListener("click", () => this.confirmDelete(record));
    const body = content.createDiv({ cls: "sat-file-view-body" });
    try {
      const data = await this.plugin.store.read(record);
      const extension = record.extension.toLowerCase();
      if (isTextExtension(extension)) {
        const text = new TextDecoder("utf-8").decode(data);
        body.createEl("pre", { text: text.slice(0, 5e5), cls: "sat-text-preview" });
        if (text.length > 5e5) {
          body.createDiv({ text: this.plugin.t("previewLimited"), cls: "sat-help" });
        }
        return;
      }
      const blob = new Blob([data], { type: mimeForExtension(extension) });
      this.objectUrl = URL.createObjectURL(blob);
      if (isImageExtension(extension)) {
        const image = body.createEl("img", { cls: "sat-image-preview" });
        image.src = this.objectUrl;
      } else if (extension === "pdf") {
        const frame = body.createEl("iframe", { cls: "sat-pdf-preview" });
        frame.src = this.objectUrl;
        frame.setAttr("title", record.fileName);
      } else if (isAudioExtension(extension)) {
        const audio = body.createEl("audio", { cls: "sat-media-preview" });
        audio.controls = true;
        audio.src = this.objectUrl;
      } else if (isVideoExtension(extension)) {
        const video = body.createEl("video", { cls: "sat-media-preview" });
        video.controls = true;
        video.src = this.objectUrl;
      } else {
        body.createDiv({ text: this.plugin.t("previewUnavailable"), cls: "sat-empty" });
      }
    } catch (error) {
      body.createDiv({
        text: this.plugin.t("previewFailed", { error: error instanceof Error ? error.message : String(error) }),
        cls: "sat-error"
      });
    }
  }
  async restore(record) {
    try {
      const restoredPath = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
      if (restoredPath) {
        new import_obsidian7.Notice(this.plugin.t("restoreSuccess", { path: restoredPath }));
        this.leaf.detach();
      } else {
        new import_obsidian7.Notice(this.plugin.t("restoreSkipped"));
      }
      await this.plugin.refreshOpenViews();
    } catch (error) {
      new import_obsidian7.Notice(this.plugin.t("restoreFailed", {
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
  confirmDelete(record) {
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("deleteFileTitle"),
      this.plugin.t("deleteFileMessage", { name: record.fileName }),
      this.plugin.t("deletePermanently"),
      true,
      async () => {
        await this.plugin.store.permanentlyDelete(record);
        new import_obsidian7.Notice(this.plugin.t("fileDeleted"));
        this.leaf.detach();
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }
  releaseObjectUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
};

// src/i18n.ts
var messages = {
  en: {
    safeTrash: "Safe Trash",
    openSafeTrash: "Open Safe Trash",
    subtitle: "Review, restore, or permanently delete quarantined files.",
    refresh: "Refresh",
    restoreSelected: "Restore selected",
    deleteSelected: "Delete selected",
    searchPlaceholder: "Search by file name or original path\u2026",
    selectAll: "Select all",
    shownSelected: "{shown} files shown \u2014 {selected} selected",
    trashEmpty: "Safe Trash is empty or no file matches the current search.",
    restore: "Restore",
    delete: "Delete",
    size: "Size: {value}",
    movedAt: "Moved: {value}",
    reason: "Reason: {value}",
    previewLimited: "Preview is limited to 500,000 characters.",
    previewUnavailable: "This file type has no built-in preview.",
    previewFailed: "Could not display the file: {error}",
    recordMissingTitle: "File is no longer in Safe Trash",
    recordMissingBody: "It may have been restored or permanently deleted.",
    noneSelected: "No file is selected.",
    trashIsEmpty: "Safe Trash is empty.",
    restoreSuccess: "File restored to {path}.",
    restoreSkipped: "Restore skipped because a file with the same name already exists.",
    restoreFailed: "Restore failed: {error}",
    restoreResult: "Restore: {restored} succeeded, {skipped} skipped, {failed} failed",
    deleteFileTitle: "Permanently delete file",
    deleteFileMessage: "Permanently delete \u201C{name}\u201D? This cannot be undone.",
    deletePermanently: "Delete permanently",
    fileDeleted: "File permanently deleted.",
    deleteSelectedTitle: "Permanently delete selected files",
    deleteSelectedMessage: "{count} files will be permanently deleted. This cannot be undone.",
    deleteResult: "Delete: {deleted} succeeded, {failed} failed",
    cancel: "Cancel",
    error: "Error: {error}",
    unusedFilesTitle: "Unused files ({count})",
    unusedHelp: "Only selected files will be moved to Safe Trash. Review the list before continuing.",
    moveCount: "Move {count} files",
    scanning: "Checking links and files\u2026",
    noUnused: "No unused file was found.",
    moveResult: "Moved to Safe Trash: {moved} succeeded, {failed} failed",
    unusedReason: "Detected as an unused file",
    moveToSafeTrash: "Move to Safe Trash",
    moveCurrentFile: "Move current file to Safe Trash",
    moveFileTitle: "Move to Safe Trash",
    moveFileMessage: "Move \u201C{path}\u201D to Safe Trash? Its original path will be saved.",
    move: "Move",
    moved: "File moved to Safe Trash.",
    alreadyInTrash: "This file is already in Safe Trash.",
    scanUnusedCommand: "Scan unused files",
    manualReason: "Moved manually",
    settingsLanguage: "Language",
    settingsLanguageDesc: "Use the Obsidian language automatically, or choose Persian or English.",
    languageAuto: "Automatic",
    languagePersian: "\u0641\u0627\u0631\u0633\u06CC",
    languageEnglish: "English",
    settingsExtensions: "File extensions",
    settingsExtensionsDesc: "Extensions checked during unused-file scans. Separate them with commas. Use * for every extension.",
    settingsExcluded: "Excluded folders",
    settingsExcludedDesc: "These folders and their subfolders are not scanned. Separate paths with commas or new lines.",
    settingsMinAge: "Minimum file age",
    settingsMinAgeDesc: "Files newer than this many hours are not considered unused. Zero disables this limit.",
    settingsConflict: "Restore conflict behavior",
    settingsConflictDesc: "What should happen when a file already exists at the original path?",
    conflictRename: "Create a restored copy with a new name",
    conflictSkip: "Skip the file",
    conflictOverwrite: "Overwrite the existing file",
    settingsCanvas: "Check Canvas files",
    settingsCanvasDesc: "Files referenced inside Canvas files are not considered unused.",
    restoredSuffix: "restored",
    cannotRestoreOverFolder: "{path} is a folder and cannot be replaced with a file.",
    fileAlreadyExists: "{path} already exists.",
    cannotCreateFolder: "Cannot create {path}; a file with the same name already exists."
  },
  fa: {
    safeTrash: "\u0633\u0637\u0644 \u0627\u0645\u0646",
    openSafeTrash: "\u0628\u0627\u0632\u06A9\u0631\u062F\u0646 \u0633\u0637\u0644 \u0627\u0645\u0646",
    subtitle: "\u0641\u0627\u06CC\u0644\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u060C \u0628\u0631\u06AF\u0631\u062F\u0627\u0646 \u06CC\u0627 \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0634\u0647 \u062D\u0630\u0641 \u06A9\u0646.",
    refresh: "\u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC",
    restoreSelected: "\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627",
    deleteSelected: "\u062D\u0630\u0641 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627",
    searchPlaceholder: "\u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u062F\u0631 \u0646\u0627\u0645 \u06CC\u0627 \u0645\u0633\u06CC\u0631 \u0627\u0635\u0644\u06CC \u0641\u0627\u06CC\u0644\u2026",
    selectAll: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0647\u0645\u0647",
    shownSelected: "{shown} \u0641\u0627\u06CC\u0644 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u2014 {selected} \u0641\u0627\u06CC\u0644 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u062F\u0647",
    trashEmpty: "\u0633\u0637\u0644 \u0627\u0645\u0646 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A \u06CC\u0627 \u0646\u062A\u06CC\u062C\u0647\u200C\u0627\u06CC \u0628\u0627 \u062C\u0633\u062A\u200C\u0648\u062C\u0648\u06CC \u0641\u0639\u0644\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.",
    restore: "\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC",
    delete: "\u062D\u0630\u0641",
    size: "\u0627\u0646\u062F\u0627\u0632\u0647: {value}",
    movedAt: "\u0632\u0645\u0627\u0646 \u0627\u0646\u062A\u0642\u0627\u0644: {value}",
    reason: "\u0639\u0644\u062A: {value}",
    previewLimited: "\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0628\u0647 \u06F5\u06F0\u06F0 \u0647\u0632\u0627\u0631 \u0646\u0648\u06CC\u0633\u0647 \u0645\u062D\u062F\u0648\u062F \u0634\u062F\u0647 \u0627\u0633\u062A.",
    previewUnavailable: "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0646\u0648\u0639 \u0641\u0627\u06CC\u0644 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062E\u0644\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.",
    previewFailed: "\u0646\u0645\u0627\u06CC\u0634 \u0641\u0627\u06CC\u0644 \u0645\u0645\u06A9\u0646 \u0646\u0634\u062F: {error}",
    recordMissingTitle: "\u0641\u0627\u06CC\u0644 \u062F\u06CC\u06AF\u0631 \u062F\u0627\u062E\u0644 \u0633\u0637\u0644 \u0627\u0645\u0646 \u0646\u06CC\u0633\u062A",
    recordMissingBody: "\u0627\u062D\u062A\u0645\u0627\u0644\u0627\u064B \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0634\u062F\u0647 \u06CC\u0627 \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0634\u0647 \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A.",
    noneSelected: "\u0647\u06CC\u0686 \u0641\u0627\u06CC\u0644\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.",
    trashIsEmpty: "\u0633\u0637\u0644 \u0627\u0645\u0646 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A.",
    restoreSuccess: "\u0641\u0627\u06CC\u0644 \u0628\u0647 {path} \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u062F\u0647 \u0634\u062F.",
    restoreSkipped: "\u0628\u0647\u200C\u062F\u0644\u06CC\u0644 \u0648\u062C\u0648\u062F \u0641\u0627\u06CC\u0644 \u0647\u0645\u200C\u0646\u0627\u0645\u060C \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0631\u062F \u0634\u062F.",
    restoreFailed: "\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F: {error}",
    restoreResult: "\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC: {restored} \u0645\u0648\u0641\u0642\u060C {skipped} \u0631\u062F\u0634\u062F\u0647\u060C {failed} \u0646\u0627\u0645\u0648\u0641\u0642",
    deleteFileTitle: "\u062D\u0630\u0641 \u06A9\u0627\u0645\u0644 \u0641\u0627\u06CC\u0644",
    deleteFileMessage: "\u0641\u0627\u06CC\u0644 \xAB{name}\xBB \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0634\u0647 \u062D\u0630\u0641 \u0634\u0648\u062F\u061F \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06CC\u0633\u062A.",
    deletePermanently: "\u062D\u0630\u0641 \u06A9\u0627\u0645\u0644",
    fileDeleted: "\u0641\u0627\u06CC\u0644 \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0634\u0647 \u062D\u0630\u0641 \u0634\u062F.",
    deleteSelectedTitle: "\u062D\u0630\u0641 \u06A9\u0627\u0645\u0644 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647",
    deleteSelectedMessage: "{count} \u0641\u0627\u06CC\u0644 \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0634\u0647 \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06CC\u0633\u062A.",
    deleteResult: "\u062D\u0630\u0641: {deleted} \u0645\u0648\u0641\u0642\u060C {failed} \u0646\u0627\u0645\u0648\u0641\u0642",
    cancel: "\u0627\u0646\u0635\u0631\u0627\u0641",
    error: "\u062E\u0637\u0627: {error}",
    unusedFilesTitle: "\u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 ({count})",
    unusedHelp: "\u0641\u0642\u0637 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646 \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0646\u062A\u0642\u0627\u0644\u060C \u0641\u0647\u0631\u0633\u062A \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.",
    moveCount: "\u0627\u0646\u062A\u0642\u0627\u0644 {count} \u0641\u0627\u06CC\u0644",
    scanning: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0631\u0633\u06CC \u0644\u06CC\u0646\u06A9\u200C\u0647\u0627 \u0648 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u2026",
    noUnused: "\u0641\u0627\u06CC\u0644 \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647\u200C\u0627\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.",
    moveResult: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646: {moved} \u0645\u0648\u0641\u0642\u060C {failed} \u0646\u0627\u0645\u0648\u0641\u0642",
    unusedReason: "\u0634\u0646\u0627\u0633\u0627\u06CC\u06CC\u200C\u0634\u062F\u0647 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u06CC\u0644 \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647",
    moveToSafeTrash: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646",
    moveCurrentFile: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0641\u0627\u06CC\u0644 \u0641\u0639\u0644\u06CC \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646",
    moveFileTitle: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646",
    moveFileMessage: "\u0641\u0627\u06CC\u0644 \xAB{path}\xBB \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646 \u0645\u0646\u062A\u0642\u0644 \u0634\u0648\u062F\u061F \u0645\u0633\u06CC\u0631 \u0627\u0635\u0644\u06CC \u0622\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    move: "\u0627\u0646\u062A\u0642\u0627\u0644",
    moved: "\u0641\u0627\u06CC\u0644 \u0628\u0647 \u0633\u0637\u0644 \u0627\u0645\u0646 \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.",
    alreadyInTrash: "\u0627\u06CC\u0646 \u0641\u0627\u06CC\u0644 \u0627\u0632 \u0642\u0628\u0644 \u062F\u0627\u062E\u0644 \u0633\u0637\u0644 \u0627\u0645\u0646 \u0627\u0633\u062A.",
    scanUnusedCommand: "\u0627\u0633\u06A9\u0646 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647",
    manualReason: "\u0627\u0646\u062A\u0642\u0627\u0644 \u062F\u0633\u062A\u06CC",
    settingsLanguage: "\u0632\u0628\u0627\u0646",
    settingsLanguageDesc: "\u0632\u0628\u0627\u0646 Obsidian \u0631\u0627 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646 \u06CC\u0627 \u0641\u0627\u0631\u0633\u06CC \u0648 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u0631\u0627 \u062F\u0633\u062A\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646.",
    languageAuto: "\u062E\u0648\u062F\u06A9\u0627\u0631",
    languagePersian: "\u0641\u0627\u0631\u0633\u06CC",
    languageEnglish: "English",
    settingsExtensions: "\u067E\u0633\u0648\u0646\u062F \u0641\u0627\u06CC\u0644\u200C\u0647\u0627",
    settingsExtensionsDesc: "\u067E\u0633\u0648\u0646\u062F\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0647\u0646\u06AF\u0627\u0645 \u0627\u0633\u06A9\u0646 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0628\u0631\u0631\u0633\u06CC \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0628\u0627 \u06A9\u0627\u0645\u0627 \u062C\u062F\u0627 \u06A9\u0646. \u0628\u0631\u0627\u06CC \u0647\u0645\u0647 \u067E\u0633\u0648\u0646\u062F\u0647\u0627 \u0627\u0632 * \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.",
    settingsExcluded: "\u067E\u0648\u0634\u0647\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u062B\u0646\u0627",
    settingsExcludedDesc: "\u0627\u06CC\u0646 \u067E\u0648\u0634\u0647\u200C\u0647\u0627 \u0648 \u0632\u06CC\u0631\u067E\u0648\u0634\u0647\u200C\u0647\u0627\u06CC\u0634\u0627\u0646 \u0627\u0633\u06A9\u0646 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0647\u0631 \u0645\u0633\u06CC\u0631 \u0631\u0627 \u0628\u0627 \u06A9\u0627\u0645\u0627 \u06CC\u0627 \u062E\u0637 \u062C\u062F\u06CC\u062F \u062C\u062F\u0627 \u06A9\u0646.",
    settingsMinAge: "\u062D\u062F\u0627\u0642\u0644 \u0639\u0645\u0631 \u0641\u0627\u06CC\u0644",
    settingsMinAgeDesc: "\u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0627\u0632 \u0627\u06CC\u0646 \u062A\u0639\u062F\u0627\u062F \u0633\u0627\u0639\u062A \u062C\u062F\u06CC\u062F\u062A\u0631\u0646\u062F\u060C \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u062D\u0633\u0648\u0628 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0635\u0641\u0631 \u06CC\u0639\u0646\u06CC \u0628\u062F\u0648\u0646 \u0645\u062D\u062F\u0648\u062F\u06CC\u062A.",
    settingsConflict: "\u0628\u0631\u062E\u0648\u0631\u062F \u0628\u0627 \u062A\u062F\u0627\u062E\u0644 \u0647\u0646\u06AF\u0627\u0645 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC",
    settingsConflictDesc: "\u0648\u0642\u062A\u06CC \u0641\u0627\u06CC\u0644\u06CC \u062F\u0631 \u0645\u0633\u06CC\u0631 \u0627\u0635\u0644\u06CC \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F\u060C \u0686\u0647 \u0627\u062A\u0641\u0627\u0642\u06CC \u0628\u06CC\u0641\u062A\u062F\u061F",
    conflictRename: "\u0633\u0627\u062E\u062A \u0646\u0633\u062E\u0647 \u0628\u0627 \u0646\u0627\u0645 \u062C\u062F\u06CC\u062F",
    conflictSkip: "\u0631\u062F \u06A9\u0631\u062F\u0646 \u0641\u0627\u06CC\u0644",
    conflictOverwrite: "\u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646\u06CC \u0641\u0627\u06CC\u0644 \u0645\u0648\u062C\u0648\u062F",
    settingsCanvas: "\u0628\u0631\u0631\u0633\u06CC \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC Canvas",
    settingsCanvasDesc: "\u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u062F\u0627\u062E\u0644 Canvas \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u060C \u0628\u0644\u0627\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u0646\u0627\u062E\u062A\u0647 \u0646\u0634\u0648\u0646\u062F.",
    restoredSuffix: "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC\u200C\u0634\u062F\u0647",
    cannotRestoreOverFolder: "\u0645\u0633\u06CC\u0631 {path} \u06CC\u06A9 \u067E\u0648\u0634\u0647 \u0627\u0633\u062A \u0648 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646 \u0641\u0627\u06CC\u0644 \u0631\u0627 \u0631\u0648\u06CC \u0622\u0646 \u0628\u0631\u06AF\u0631\u062F\u0627\u0646\u062F.",
    fileAlreadyExists: "\u0641\u0627\u06CC\u0644 {path} \u0627\u0632 \u0642\u0628\u0644 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F.",
    cannotCreateFolder: "\u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646 \u067E\u0648\u0634\u0647 {path} \u0631\u0627 \u0633\u0627\u062E\u062A\u061B \u0641\u0627\u06CC\u0644\u06CC \u0628\u0627 \u0647\u0645\u06CC\u0646 \u0646\u0627\u0645 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F."
  }
};
function resolveLanguage(mode) {
  var _a;
  if (mode === "fa" || mode === "en") return mode;
  const candidates = [];
  if (typeof document !== "undefined") candidates.push(document.documentElement.lang || "");
  if (typeof window !== "undefined") candidates.push(((_a = window.localStorage) == null ? void 0 : _a.getItem("language")) || "");
  if (typeof navigator !== "undefined") candidates.push(navigator.language || "");
  return candidates.some((value) => value.toLowerCase().startsWith("fa")) ? "fa" : "en";
}
function translate(language, key, params = {}) {
  var _a;
  const template = (_a = messages[language][key]) != null ? _a : messages.en[key];
  return template.replace(/\{(\w+)\}/g, (_match, name) => {
    var _a2;
    return String((_a2 = params[name]) != null ? _a2 : `{${name}}`);
  });
}

// src/main.ts
var SafeAttachmentTrashPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.scanInProgress = false;
    this.scanReviewOpen = false;
  }
  get language() {
    return resolveLanguage(this.settings.language);
  }
  get locale() {
    return this.language === "fa" ? "fa-IR" : "en-US";
  }
  t(key, params = {}) {
    return translate(this.language, key, params);
  }
  async onload() {
    await this.loadSettings();
    this.store = new SafeTrashStore(this.app, (key, params) => this.t(key, params));
    await this.store.initialize();
    this.registerView(VIEW_TYPE_SAFE_TRASH, (leaf) => new SafeTrashView(leaf, this));
    this.registerView(VIEW_TYPE_SAFE_TRASH_PREVIEW, (leaf) => new SafeTrashPreviewView(leaf, this));
    this.addSettingTab(new SafeTrashSettingTab(this.app, this));
    this.addRibbonIcon("trash-2", this.t("openSafeTrash"), () => void this.activateView());
    this.addCommand({
      id: "open-safe-trash",
      name: this.t("openSafeTrash"),
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "scan-unused-attachments",
      name: this.t("scanUnusedCommand"),
      callback: () => void this.scanUnused({ silentWhenEmpty: false })
    });
    this.addCommand({
      id: "move-active-file-to-safe-trash",
      name: this.t("moveCurrentFile"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.confirmMoveFile(file, this.t("manualReason"));
        return true;
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof import_obsidian8.TFile)) return;
      menu.addItem((item) => item.setTitle(this.t("moveToSafeTrash")).setIcon("trash-2").onClick(() => this.confirmMoveFile(file, this.t("manualReason"))));
    }));
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SAFE_TRASH);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SAFE_TRASH_PREVIEW);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async refreshLanguage() {
    await this.refreshOpenViews();
  }
  async activateView() {
    var _a;
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      if (existing.view instanceof SafeTrashView) await existing.view.refresh();
      await this.scanUnused({ silentWhenEmpty: true });
      return;
    }
    const leaf = (_a = this.app.workspace.getRightLeaf(false)) != null ? _a : this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SAFE_TRASH, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openTrashRecord(recordId) {
    const record = this.store.get(recordId);
    if (!record) return;
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH_PREVIEW).find((leaf2) => {
      var _a;
      return ((_a = leaf2.getViewState().state) == null ? void 0 : _a.recordId) === recordId;
    });
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_SAFE_TRASH_PREVIEW,
      active: true,
      state: { recordId }
    });
    await this.app.workspace.revealLeaf(leaf);
  }
  async scanUnused(options = {}) {
    if (this.scanInProgress || this.scanReviewOpen) return;
    this.scanInProgress = true;
    if (!options.silentWhenEmpty) new import_obsidian8.Notice(this.t("scanning"));
    let candidates;
    try {
      const scanner = new UnusedAttachmentScanner(this.app, this.settings);
      candidates = await scanner.scan();
    } catch (error) {
      new import_obsidian8.Notice(this.t("error", { error: error instanceof Error ? error.message : String(error) }));
      return;
    } finally {
      this.scanInProgress = false;
    }
    if (candidates.length === 0) {
      if (!options.silentWhenEmpty) new import_obsidian8.Notice(this.t("noUnused"));
      await this.refreshOpenViews();
      return;
    }
    this.scanReviewOpen = true;
    new ScanReviewModal(
      this.app,
      this,
      candidates,
      async (paths) => {
        let moved = 0;
        let failed = 0;
        for (const path of paths) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof import_obsidian8.TFile)) {
            failed += 1;
            continue;
          }
          try {
            await this.store.moveToTrash(file, this.t("unusedReason"));
            moved += 1;
          } catch (e) {
            failed += 1;
          }
        }
        new import_obsidian8.Notice(this.t("moveResult", { moved, failed }));
        await this.refreshOpenViews();
      },
      () => {
        this.scanReviewOpen = false;
      }
    ).open();
  }
  confirmMoveFile(file, reason) {
    new ConfirmModal(
      this.app,
      this,
      this.t("moveFileTitle"),
      this.t("moveFileMessage", { path: file.path }),
      this.t("move"),
      false,
      async () => {
        await this.store.moveToTrash(file, reason);
        new import_obsidian8.Notice(this.t("moved"));
        await this.refreshOpenViews();
      }
    ).open();
  }
  async refreshOpenViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH)) {
      if (leaf.view instanceof SafeTrashView) await leaf.view.refresh();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH_PREVIEW)) {
      if (leaf.view instanceof SafeTrashPreviewView) await leaf.view.refresh();
    }
  }
};
