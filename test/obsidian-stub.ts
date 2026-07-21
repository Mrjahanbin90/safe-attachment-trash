export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  stat: { size: number; mtime: number; ctime: number };

  constructor(path: string, data: ArrayBuffer, mtime = Date.now()) {
    this.path = normalizePath(path);
    this.name = this.path.split("/").pop() ?? this.path;
    const dot = this.name.lastIndexOf(".");
    this.extension = dot >= 0 ? this.name.slice(dot + 1) : "";
    this.stat = { size: data.byteLength, mtime, ctime: mtime };
  }
}

export class TFolder {
  path: string;
  constructor(path: string) { this.path = normalizePath(path); }
}

export class App {
  vault: any;
  metadataCache: any;
  fileManager: any;

  constructor(vault: any, metadataCache: any = {}, deletionMode: "local" | "system" | "permanent" = "local") {
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.fileManager = {
      trashFile: async (file: TFile) => vault.trashByPreference(file, deletionMode)
    };
  }
}

export class Plugin {}
export class ItemView {}
export class Modal {}
export class PluginSettingTab {}
export class Notice {}
export class Setting {}
export class Menu {}
export class WorkspaceLeaf {}

export function getLanguage(): string { return "en"; }
