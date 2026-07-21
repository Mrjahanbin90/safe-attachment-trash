import { App, TFile, TFolder, normalizePath } from "obsidian";
import { SafeTrashStore } from "../src/store";
import { UnusedAttachmentScanner } from "../src/scanner";
import type { SafeTrashSettings, TrashRecord } from "../src/types";

(globalThis as typeof globalThis & { window: typeof globalThis }).window = globalThis;

class MemoryAdapter {
  files = new Map<string, { data: ArrayBuffer | string; mtime: number }>();
  folders = new Set<string>();

  async exists(path: string) {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.folders.has(normalized);
  }

  async stat(path: string) {
    const normalized = normalizePath(path);
    const file = this.files.get(normalized);
    if (file) {
      const size = typeof file.data === "string" ? new TextEncoder().encode(file.data).byteLength : file.data.byteLength;
      return { type: "file", size, mtime: file.mtime, ctime: file.mtime };
    }
    if (this.folders.has(normalized)) return { type: "folder", size: 0, mtime: 0, ctime: 0 };
    return null;
  }

  async mkdir(path: string) { this.folders.add(normalizePath(path)); }

  async writeBinary(path: string, data: ArrayBuffer, options?: { mtime?: number }) {
    this.files.set(normalizePath(path), { data: data.slice(0), mtime: options?.mtime ?? Date.now() });
  }

  async readBinary(path: string) {
    const value = this.files.get(normalizePath(path))?.data;
    if (!(value instanceof ArrayBuffer)) throw new Error("not binary");
    return value.slice(0);
  }

  async write(path: string, data: string) {
    this.files.set(normalizePath(path), { data, mtime: Date.now() });
  }

  async read(path: string) {
    const value = this.files.get(normalizePath(path))?.data;
    if (typeof value !== "string") throw new Error("not text");
    return value;
  }

  async remove(path: string) {
    this.files.delete(normalizePath(path));
    this.folders.delete(normalizePath(path));
  }

  async rename(path: string, newPath: string) {
    const source = normalizePath(path);
    const target = normalizePath(newPath);
    const file = this.files.get(source);
    if (!file) throw new Error("source missing");
    this.files.set(target, file);
    this.files.delete(source);
  }

  async rmdir(path: string, recursive: boolean) {
    const normalized = normalizePath(path);
    if (recursive) {
      for (const file of [...this.files.keys()]) if (file.startsWith(`${normalized}/`)) this.files.delete(file);
      for (const folder of [...this.folders]) if (folder === normalized || folder.startsWith(`${normalized}/`)) this.folders.delete(folder);
      return;
    }
    const hasChildren = [...this.files.keys(), ...this.folders].some((item) => item.startsWith(`${normalized}/`));
    if (hasChildren) throw new Error("not empty");
    this.folders.delete(normalized);
  }

  async list(folder: string) {
    const normalized = normalizePath(folder);
    const prefix = `${normalized}/`;
    const files = [...this.files.keys()].filter((path) => {
      if (!path.startsWith(prefix)) return false;
      return !path.slice(prefix.length).includes("/");
    });
    const folders = [...this.folders].filter((path) => {
      if (!path.startsWith(prefix)) return false;
      return !path.slice(prefix.length).includes("/");
    });
    return { files, folders };
  }
}

class MemoryVault {
  adapter = new MemoryAdapter();
  files = new Map<string, { file: TFile; data: ArrayBuffer; text?: string }>();
  folders = new Map<string, TFolder>();

  addBinary(path: string, text: string, mtime = Date.now()) {
    const data = new TextEncoder().encode(text).buffer;
    const file = new TFile(path, data, mtime);
    this.files.set(file.path, { file, data });
    this.ensureVisibleFolders(file.path);
    return file;
  }

  addText(path: string, text: string, mtime = Date.now()) {
    const data = new TextEncoder().encode(text).buffer;
    const file = new TFile(path, data, mtime);
    this.files.set(file.path, { file, data, text });
    this.ensureVisibleFolders(file.path);
    return file;
  }

  getFiles() { return [...this.files.values()].map((value) => value.file); }
  getMarkdownFiles() { return this.getFiles().filter((file) => file.extension === "md"); }
  getFileByPath(path: string) { return this.files.get(normalizePath(path))?.file ?? null; }
  getAbstractFileByPath(path: string) {
    const normalized = normalizePath(path);
    return this.files.get(normalized)?.file ?? this.folders.get(normalized) ?? null;
  }
  async readBinary(file: TFile) { return this.files.get(file.path)?.data.slice(0) ?? new ArrayBuffer(0); }
  async cachedRead(file: TFile) {
    const entry = this.files.get(file.path);
    if (!entry) throw new Error("missing");
    return entry.text ?? new TextDecoder().decode(entry.data);
  }
  async createBinary(path: string, data: ArrayBuffer, options?: { mtime?: number }) {
    const normalized = normalizePath(path);
    const file = new TFile(normalized, data, options?.mtime);
    this.files.set(normalized, { file, data: data.slice(0) });
    this.ensureVisibleFolders(normalized);
    return file;
  }
  async modifyBinary(file: TFile, data: ArrayBuffer, options?: { mtime?: number }) {
    const replacement = new TFile(file.path, data, options?.mtime);
    this.files.set(file.path, { file: replacement, data: data.slice(0) });
  }
  async createFolder(path: string) {
    const folder = new TFolder(path);
    this.folders.set(folder.path, folder);
    return folder;
  }

  async trashByPreference(file: TFile, mode: "local" | "system" | "permanent") {
    const entry = this.files.get(file.path);
    if (!entry) throw new Error("missing");
    this.files.delete(file.path);
    if (mode !== "local") return;

    const trashPath = normalizePath(`.trash/${file.path}`);
    const parts = trashPath.split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      await this.adapter.mkdir(current);
    }
    await this.adapter.writeBinary(trashPath, entry.data, { mtime: file.stat.mtime });
  }

  private ensureVisibleFolders(path: string) {
    const parts = normalizePath(path).split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.folders.has(current)) this.folders.set(current, new TFolder(current));
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const t = (key: string) => key;
const recoveryFolder = "Recovered from Trash";

async function makeStore(vault: MemoryVault, mode: "local" | "system" | "permanent" = "local") {
  let persisted: TrashRecord[] = [];
  const app = new App(vault, {}, mode) as any;
  const store = new SafeTrashStore(app, async (records) => { persisted = records; }, t as any);
  await store.initialize(persisted);
  return store;
}

async function testLocalTrashMoveAndRestore() {
  const vault = new MemoryVault();
  const file = vault.addBinary("Assets/picture.png", "abc", Date.now() - 10_000);
  const store = await makeStore(vault, "local");
  const record = await store.moveToTrash(file, "test");
  assert(!vault.getFileByPath("Assets/picture.png"), "source must be removed");
  assert(record.trashPath === ".trash/Assets/picture.png", "local trash path must be detected");
  const restored = await store.restore(record, "rename", recoveryFolder);
  assert(restored === "Assets/picture.png", "restore path must match original");
  assert(vault.getFileByPath("Assets/picture.png") instanceof TFile, "restored file must exist");
  assert(store.list().length === 0, "record must be removed after restore");
}

async function testSystemTrashStillGetsLocalRecoveryCopy() {
  const vault = new MemoryVault();
  const file = vault.addBinary("Assets/system.png", "system", Date.now() - 10_000);
  const store = await makeStore(vault, "system");
  const record = await store.moveToTrash(file, "test");
  assert(record.trashPath === ".trash/Assets/system.png", "plugin must create a local recovery copy");
  assert(await vault.adapter.exists(record.trashPath), "local recovery copy must exist");
  await store.restore(record, "rename", recoveryFolder);
  assert(vault.getFileByPath("Assets/system.png") instanceof TFile, "system-trash deletion must remain restorable");
}

async function testDiscoverUnknownTrashFile() {
  const vault = new MemoryVault();
  await vault.adapter.mkdir(".trash");
  await vault.adapter.writeBinary(".trash/orphan.pdf", new TextEncoder().encode("pdf").buffer);
  const store = await makeStore(vault);
  const record = store.list()[0];
  assert(record?.originalPath === null, "root trash file must have unknown original path");
  const restored = await store.restore(record, "rename", recoveryFolder);
  assert(restored === "Recovered from Trash/orphan.pdf", "unknown files must restore to recovery folder");
}


async function testLegacyMigration() {
  const vault = new MemoryVault();
  await vault.adapter.mkdir(".safe-attachment-trash");
  await vault.adapter.mkdir(".safe-attachment-trash/files");
  const legacyData = new TextEncoder().encode("legacy").buffer;
  await vault.adapter.writeBinary(".safe-attachment-trash/files/old--legacy.png", legacyData);
  await vault.adapter.write(".safe-attachment-trash/index.json", JSON.stringify({
    version: 1,
    records: [{
      id: "old",
      originalPath: "Assets/legacy.png",
      storedPath: ".safe-attachment-trash/files/old--legacy.png",
      fileName: "legacy.png",
      extension: "png",
      size: legacyData.byteLength,
      trashedAt: Date.now() - 1000,
      originalMtime: Date.now() - 2000,
      reason: "legacy"
    }]
  }));
  const store = await makeStore(vault);
  const record = store.list()[0];
  assert(record?.source === "legacy", "legacy record must be migrated");
  assert(record?.trashPath?.startsWith(".trash/Safe Attachment Trash Legacy/") === true, "legacy file must move into Obsidian trash");
  assert(!(await vault.adapter.exists(".safe-attachment-trash")), "legacy root must be removed after successful migration");
}

function scannerSettings(): SafeTrashSettings {
  return {
    language: "auto",
    autoScanOnPanelOpen: true,
    extensions: "png, pdf",
    excludedFolders: "Templates",
    minimumAgeHours: 0,
    conflictBehavior: "rename",
    scanCanvasFiles: true,
    recoveryFolder
  };
}

function makeMetadataCache(vault: MemoryVault, caches: Record<string, unknown> = {}) {
  return {
    resolvedLinks: {},
    getFileCache: (file: TFile) => caches[file.path] ?? { links: [], embeds: [] },
    getFirstLinkpathDest: (link: string, sourcePath: string) => {
      const cleaned = link.split("#")[0]?.trim() ?? "";
      const direct = vault.getAbstractFileByPath(cleaned);
      if (direct) return direct;
      const sourceFolder = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
      return vault.getAbstractFileByPath(normalizePath(`${sourceFolder}/${cleaned}`));
    }
  };
}

async function testScanner() {
  const vault = new MemoryVault();
  vault.addText("Notes/a.md", "![[Assets/used.png]]");
  vault.addBinary("Assets/used.png", "used", Date.now() - 100_000);
  vault.addBinary("Assets/unused.png", "unused", Date.now() - 100_000);
  vault.addBinary("Templates/ignored.png", "ignored", Date.now() - 100_000);
  const metadataCache = makeMetadataCache(vault, {
    "Notes/a.md": { links: [], embeds: [{ link: "Assets/used.png" }] }
  });
  metadataCache.resolvedLinks = { "Notes/a.md": { "Assets/used.png": 1 } };
  const scanner = new UnusedAttachmentScanner(new App(vault, metadataCache) as any, scannerSettings());
  const result = await scanner.scan();
  assert(result.length === 1 && result[0]?.path === "Assets/unused.png", "scanner must return only unused non-excluded file");
}

async function testFrontmatterAndBasesReferences() {
  const vault = new MemoryVault();
  vault.addText("Notes/book.md", "---\ncover: '[[Assets/cover.png]]'\n---\n");
  vault.addText("Library.base", "views:\n  - type: cards\n    image: note.cover\n");
  vault.addBinary("Assets/cover.png", "cover", Date.now() - 100_000);
  vault.addBinary("Assets/base-direct.png", "base", Date.now() - 100_000);
  vault.addText("Direct.base", "image: 'Assets/base-direct.png'\n");
  vault.addBinary("Assets/unused.png", "unused", Date.now() - 100_000);

  const metadataCache = makeMetadataCache(vault, {
    "Notes/book.md": {
      links: [],
      embeds: [],
      frontmatter: { cover: "[[Assets/cover.png]]" }
    }
  });
  const scanner = new UnusedAttachmentScanner(new App(vault, metadataCache) as any, scannerSettings());
  const result = await scanner.scan();
  const paths = new Set(result.map((item) => item.path));
  assert(!paths.has("Assets/cover.png"), "frontmatter attachment used by Bases must not be reported unused");
  assert(!paths.has("Assets/base-direct.png"), "direct attachment reference in a .base file must not be reported unused");
  assert(paths.has("Assets/unused.png"), "an actually unused attachment must still be reported");
}

async function testProtectedFilesAreExcluded() {
  const vault = new MemoryVault();
  vault.addBinary("Assets/keep.png", "keep", Date.now() - 100_000);
  vault.addBinary("Assets/remove.png", "remove", Date.now() - 100_000);
  const scanner = new UnusedAttachmentScanner(
    new App(vault, makeMetadataCache(vault)) as any,
    scannerSettings(),
    new Set(["Assets/keep.png"])
  );
  const result = await scanner.scan();
  assert(result.length === 1 && result[0]?.path === "Assets/remove.png", "protected files must not be suggested again");
}

(async () => {
  await testLocalTrashMoveAndRestore();
  await testSystemTrashStillGetsLocalRecoveryCopy();
  await testDiscoverUnknownTrashFile();
  await testLegacyMigration();
  await testScanner();
  await testFrontmatterAndBasesReferences();
  await testProtectedFilesAreExcluded();
  console.log("All Safe Attachment Trash tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
