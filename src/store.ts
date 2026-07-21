import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { ConflictBehavior, TrashIndex, TrashRecord } from "./types";
import type { TranslationKey } from "./i18n";
import {
  ensureAdapterFolder,
  sanitizeStoredName,
  TRASH_FILES,
  TRASH_INDEX,
  TRASH_META,
  TRASH_ROOT,
  uniqueId
} from "./utils";

export class SafeTrashStore {
  private app: App;
  private records: TrashRecord[] = [];

  constructor(
    app: App,
    private t: (key: TranslationKey, params?: Record<string, string | number>) => string = (key) => key
  ) {
    this.app = app;
  }

  async initialize(): Promise<void> {
    const adapter = this.app.vault.adapter;
    await ensureAdapterFolder(adapter, TRASH_ROOT);
    await ensureAdapterFolder(adapter, TRASH_FILES);
    await ensureAdapterFolder(adapter, TRASH_META);
    this.records = await this.loadRecords();
    await this.saveIndex();
  }

  list(): TrashRecord[] {
    return [...this.records].sort((a, b) => b.trashedAt - a.trashedAt);
  }

  get(id: string): TrashRecord | undefined {
    return this.records.find((record) => record.id === id);
  }

  async read(record: TrashRecord): Promise<ArrayBuffer> {
    return this.app.vault.adapter.readBinary(record.storedPath);
  }

  async moveToTrash(file: TFile, reason: string): Promise<TrashRecord> {
    if (file.path.startsWith(`${TRASH_ROOT}/`)) {
      throw new Error(this.t("alreadyInTrash"));
    }

    const data = await this.app.vault.readBinary(file);
    const id = uniqueId();
    const storedName = `${id}--${sanitizeStoredName(file.name)}`;
    const storedPath = normalizePath(`${TRASH_FILES}/${storedName}`);
    const metadataPath = normalizePath(`${TRASH_META}/${id}.json`);
    const record: TrashRecord = {
      id,
      originalPath: file.path,
      storedPath,
      metadataPath,
      fileName: file.name,
      extension: file.extension?.toLowerCase() ?? "",
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
      await this.saveIndex().catch(() => undefined);
      if (await adapter.exists(storedPath)) await adapter.remove(storedPath).catch(() => undefined);
      if (await adapter.exists(metadataPath)) await adapter.remove(metadataPath).catch(() => undefined);
      throw error;
    }
  }

  async restore(record: TrashRecord, behavior: ConflictBehavior): Promise<string | null> {
    const data = await this.read(record);
    const target = this.resolveRestoreTarget(record.originalPath, behavior);
    if (!target) return null;

    await this.ensureVisibleParent(target);
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing instanceof TFolder) {
      throw new Error(this.t("cannotRestoreOverFolder", { path: target }));
    }

    if (existing instanceof TFile && behavior === "overwrite") {
      await this.app.vault.modifyBinary(existing, data);
    } else if (!existing) {
      await this.app.vault.createBinary(target, data);
    } else {
      throw new Error(this.t("fileAlreadyExists", { path: target }));
    }

    await this.removeRecordFiles(record);
    return target;
  }

  async restoreAll(behavior: ConflictBehavior): Promise<{ restored: number; skipped: number; failed: number }> {
    const snapshot = this.list();
    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of snapshot) {
      try {
        const result = await this.restore(record, behavior);
        if (result) restored += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
    return { restored, skipped, failed };
  }

  async permanentlyDelete(record: TrashRecord): Promise<void> {
    await this.removeRecordFiles(record);
  }

  async empty(): Promise<{ deleted: number; failed: number }> {
    const snapshot = this.list();
    let deleted = 0;
    let failed = 0;
    for (const record of snapshot) {
      try {
        await this.removeRecordFiles(record);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    return { deleted, failed };
  }

  private resolveRestoreTarget(originalPath: string, behavior: ConflictBehavior): string | null {
    const normalized = normalizePath(originalPath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (!existing) return normalized;
    if (behavior === "skip") return null;
    if (behavior === "overwrite" && existing instanceof TFile) return normalized;
    return this.makeUniquePath(normalized);
  }

  private makeUniquePath(originalPath: string): string {
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
    return normalizePath(candidate);
  }

  private async ensureVisibleParent(filePath: string): Promise<void> {
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
      } else if (!(existing instanceof TFolder)) {
        throw new Error(this.t("cannotCreateFolder", { path: current }));
      }
    }
  }

  private async removeRecordFiles(record: TrashRecord): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(record.storedPath)) await adapter.remove(record.storedPath);
    if (await adapter.exists(record.metadataPath)) await adapter.remove(record.metadataPath);
    this.records = this.records.filter((item) => item.id !== record.id);
    await this.saveIndex();
  }

  private async loadRecords(): Promise<TrashRecord[]> {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(TRASH_INDEX)) {
      try {
        const parsed = JSON.parse(await adapter.read(TRASH_INDEX)) as TrashIndex;
        if (Array.isArray(parsed.records)) {
          const valid: TrashRecord[] = [];
          for (const record of parsed.records) {
            if (record?.id && record?.storedPath && await adapter.exists(record.storedPath)) valid.push(record);
          }
          return valid;
        }
      } catch {
        // Fall through to sidecar recovery.
      }
    }

    const recovered: TrashRecord[] = [];
    try {
      const listing = await adapter.list(TRASH_META);
      for (const path of listing.files.filter((item: string) => item.endsWith(".json"))) {
        try {
          const record = JSON.parse(await adapter.read(path)) as TrashRecord;
          if (record?.id && record?.storedPath && await adapter.exists(record.storedPath)) recovered.push(record);
        } catch {
          // Ignore invalid sidecars and continue recovering the rest.
        }
      }
    } catch {
      return [];
    }
    return recovered;
  }

  private async saveIndex(): Promise<void> {
    const index: TrashIndex = { version: 1, records: this.records };
    await this.app.vault.adapter.write(TRASH_INDEX, JSON.stringify(index, null, 2));
  }
}
