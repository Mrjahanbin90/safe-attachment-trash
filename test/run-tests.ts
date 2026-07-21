import { App, TFile, TFolder, normalizePath } from "obsidian";
import { SafeTrashStore } from "../src/store";
import { UnusedAttachmentScanner } from "../src/scanner";
import type { SafeTrashSettings } from "../src/types";

class MemoryAdapter {
  files = new Map<string, ArrayBuffer | string>();
  folders = new Set<string>();
  async exists(path: string) { path = normalizePath(path); return this.files.has(path) || this.folders.has(path); }
  async mkdir(path: string) { this.folders.add(normalizePath(path)); }
  async writeBinary(path: string, data: ArrayBuffer) { this.files.set(normalizePath(path), data.slice(0)); }
  async readBinary(path: string) { const v = this.files.get(normalizePath(path)); if (!(v instanceof ArrayBuffer)) throw new Error("not binary"); return v.slice(0); }
  async write(path: string, data: string) { this.files.set(normalizePath(path), data); }
  async read(path: string) { const v = this.files.get(normalizePath(path)); if (typeof v !== "string") throw new Error("not text"); return v; }
  async remove(path: string) { this.files.delete(normalizePath(path)); this.folders.delete(normalizePath(path)); }
  async list(folder: string) { const prefix = `${normalizePath(folder)}/`; return { files: [...this.files.keys()].filter(p=>p.startsWith(prefix)), folders: [...this.folders].filter(p=>p.startsWith(prefix)) }; }
}

class MemoryVault {
  adapter = new MemoryAdapter();
  files = new Map<string, { file: TFile; data: ArrayBuffer; text?: string }>();
  folders = new Map<string, TFolder>();
  addBinary(path: string, text: string, mtime = Date.now()) { const data = new TextEncoder().encode(text).buffer; const file = new TFile(path, data, mtime); this.files.set(file.path, { file, data }); return file; }
  addText(path: string, text: string, mtime = Date.now()) { const data = new TextEncoder().encode(text).buffer; const file = new TFile(path, data, mtime); this.files.set(file.path, { file, data, text }); return file; }
  getFiles() { return [...this.files.values()].map(v=>v.file); }
  getMarkdownFiles() { return this.getFiles().filter(f=>f.extension === "md"); }
  getAbstractFileByPath(path: string) { path = normalizePath(path); return this.files.get(path)?.file ?? this.folders.get(path) ?? null; }
  async readBinary(file: TFile) { return this.files.get(file.path)!.data.slice(0); }
  async cachedRead(file: TFile) { return this.files.get(file.path)!.text ?? new TextDecoder().decode(this.files.get(file.path)!.data); }
  async delete(file: TFile) { this.files.delete(file.path); }
  async createBinary(path: string, data: ArrayBuffer) { path=normalizePath(path); const file = new TFile(path, data); this.files.set(path,{file,data:data.slice(0)}); return file; }
  async modifyBinary(file: TFile, data: ArrayBuffer) { this.files.set(file.path,{file:new TFile(file.path,data),data:data.slice(0)}); }
  async createFolder(path: string) { const folder = new TFolder(normalizePath(path)); this.folders.set(folder.path, folder); return folder; }
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function testStore() {
  const vault = new MemoryVault();
  const file = vault.addBinary("Assets/picture.png", "abc");
  const app = new App(vault) as any;
  const store = new SafeTrashStore(app);
  await store.initialize();
  const record = await store.moveToTrash(file, "test");
  assert(!vault.getAbstractFileByPath("Assets/picture.png"), "source must be removed after move");
  assert(store.list().length === 1, "record must be indexed");
  assert(await vault.adapter.exists(record.storedPath), "stored binary must exist");
  const restored = await store.restore(record, "rename");
  assert(restored === "Assets/picture.png", "restore path must match original");
  assert(vault.getAbstractFileByPath("Assets/picture.png") instanceof TFile, "restored file must exist");
  assert(store.list().length === 0, "trash must be empty after restore");
}

async function testScanner() {
  const vault = new MemoryVault();
  vault.addText("Notes/a.md", "![[Assets/used.png]]");
  vault.addBinary("Assets/used.png", "used", Date.now() - 100000);
  vault.addBinary("Assets/unused.png", "unused", Date.now() - 100000);
  vault.addBinary("Templates/ignored.png", "ignored", Date.now() - 100000);
  const metadataCache = {
    resolvedLinks: { "Notes/a.md": { "Assets/used.png": 1 } },
    getFileCache: () => ({ links: [], embeds: [{ link: "Assets/used.png" }] }),
    getFirstLinkpathDest: (link: string) => vault.getAbstractFileByPath(link)
  };
  const settings: SafeTrashSettings = {
    extensions: "png",
    excludedFolders: "Templates",
    minimumAgeHours: 0,
    conflictBehavior: "rename",
    scanCanvasFiles: true
  };
  const scanner = new UnusedAttachmentScanner(new App(vault, metadataCache) as any, settings);
  const result = await scanner.scan();
  assert(result.length === 1 && result[0].path === "Assets/unused.png", "scanner must return only unused non-excluded file");
}

(async () => {
  await testStore();
  await testScanner();
  console.log("All Safe Attachment Trash tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
