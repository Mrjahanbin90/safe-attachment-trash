import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { ConflictBehavior, LegacyTrashIndex, LegacyTrashRecord, TrashRecord } from "./types";
import type { TranslationKey } from "./i18n";
import {
  ensureAdapterFolder,
  extensionFromName,
  fileNameFromPath,
  fingerprintBinary,
  LEGACY_TRASH_INDEX,
  LEGACY_TRASH_ROOT,
  listAdapterFilesRecursively,
  makeUniqueAdapterPath,
  OBSIDIAN_TRASH_ROOT,
  sanitizeStoredName,
  sleep,
  uniqueId
} from "./utils";

interface TrashSnapshotEntry {
  size: number;
  mtime: number;
}

interface DeletedFileSnapshot {
  path: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
}

export interface MigrationResult {
  migrated: number;
  failed: number;
}

export class SafeTrashStore {
  private records: TrashRecord[] = [];
  private knownTrashPaths = new Set<string>();
  private recentInternalMoves = new Map<string, number>();

  constructor(
    private app: App,
    private persist: (records: TrashRecord[]) => Promise<void>,
    private t: (key: TranslationKey, params?: Record<string, string | number>) => string = (key) => key
  ) {}

  async initialize(initialRecords: TrashRecord[]): Promise<MigrationResult> {
    this.records = initialRecords.map((record) => this.normalizeRecord(record)).filter((record): record is TrashRecord => record !== null);
    const migration = await this.migrateLegacyTrash();
    await this.reconcile();
    return migration;
  }

  list(): TrashRecord[] {
    return this.records
      .filter((record) => record.trashPath !== null)
      .sort((a, b) => b.trashedAt - a.trashedAt);
  }

  exportRecords(): TrashRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  get(id: string): TrashRecord | undefined {
    return this.records.find((record) => record.id === id && record.trashPath !== null);
  }

  getRestoreTarget(record: TrashRecord, recoveryFolder: string): string {
    if (record.originalPath) return normalizePath(record.originalPath);
    const folder = normalizePath(recoveryFolder.trim() || "Recovered from Trash");
    return normalizePath(`${folder}/${record.fileName}`);
  }

  async read(record: TrashRecord): Promise<ArrayBuffer> {
    if (!record.trashPath || !(await this.app.vault.adapter.exists(record.trashPath))) {
      throw new Error(this.t("trashFileMissing"));
    }
    return this.app.vault.adapter.readBinary(record.trashPath);
  }

  isInternalMove(path: string): boolean {
    const now = Date.now();
    for (const [candidate, expires] of this.recentInternalMoves) {
      if (expires <= now) this.recentInternalMoves.delete(candidate);
    }
    return (this.recentInternalMoves.get(normalizePath(path)) ?? 0) > now;
  }

  async moveToTrash(file: TFile, reason: string): Promise<TrashRecord> {
    if (file.path.startsWith(`${OBSIDIAN_TRASH_ROOT}/`)) throw new Error(this.t("alreadyInTrash"));

    const binary = await this.app.vault.readBinary(file);
    const before = await this.snapshotTrash();
    const record: TrashRecord = {
      id: uniqueId(),
      originalPath: normalizePath(file.path),
      originalPathConfidence: "known",
      trashPath: null,
      fileName: file.name,
      extension: file.extension.toLowerCase(),
      size: file.stat.size,
      trashedAt: Date.now(),
      originalMtime: file.stat.mtime,
      reason,
      source: "plugin",
      fingerprint: fingerprintBinary(binary)
    };

    this.records.push(record);
    await this.persistRecords();
    this.recentInternalMoves.set(normalizePath(file.path), Date.now() + 10_000);

    let moved = false;
    try {
      // Follow the user's deletion preference through FileManager. If that preference
      // sends the original to the system trash (or deletes it permanently), keep the
      // recovery copy inside Obsidian's local .trash so preview and restore still work.
      await this.app.fileManager.trashFile(file);
      moved = true;
      await sleep(30);
      const detectedPath = await this.identifyMovedPath(before, record);
      const trashPath = detectedPath ?? await this.materializeLocalRecoveryCopy(record, binary);
      record.trashPath = trashPath;
      this.knownTrashPaths.add(trashPath);
      await this.persistRecords();
      return record;
    } catch (error) {
      if (!moved) {
        this.records = this.records.filter((item) => item.id !== record.id);
        await this.persistRecords();
      }
      throw error;
    }
  }

  private async materializeLocalRecoveryCopy(record: TrashRecord, data: ArrayBuffer): Promise<string> {
    const originalPath = record.originalPath ?? record.fileName;
    const desiredPath = normalizePath(`${OBSIDIAN_TRASH_ROOT}/${originalPath}`);
    const slash = desiredPath.lastIndexOf("/");
    if (slash > 0) await ensureAdapterFolder(this.app.vault.adapter, desiredPath.slice(0, slash));
    const target = await makeUniqueAdapterPath(this.app.vault.adapter, desiredPath);
    await this.app.vault.adapter.writeBinary(target, data, { mtime: record.originalMtime });
    return target;
  }

  async observeDeletion(file: TFile): Promise<void> {
    const originalPath = normalizePath(file.path);
    if (this.isInternalMove(originalPath)) return;

    const snapshot: DeletedFileSnapshot = {
      path: originalPath,
      name: file.name,
      extension: file.extension.toLowerCase(),
      size: file.stat.size,
      mtime: file.stat.mtime
    };

    await sleep(100);
    const files = await listAdapterFilesRecursively(this.app.vault.adapter, OBSIDIAN_TRASH_ROOT);
    const unmatched = files.filter((item) => !this.knownTrashPaths.has(item.path));
    const matched = this.bestMetadataMatch(unmatched, snapshot);
    if (!matched) return;

    this.knownTrashPaths.add(matched.path);
    if (this.records.some((record) => record.trashPath === matched.path)) return;
    this.records.push({
      id: uniqueId(),
      originalPath: snapshot.path,
      originalPathConfidence: "known",
      trashPath: matched.path,
      fileName: snapshot.name,
      extension: snapshot.extension,
      size: matched.size,
      trashedAt: Date.now(),
      originalMtime: snapshot.mtime,
      reason: this.t("observedReason"),
      source: "observed"
    });
    await this.persistRecords();
  }

  async reconcile(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const files = await listAdapterFilesRecursively(adapter, OBSIDIAN_TRASH_ROOT);
    const byPath = new Map(files.map((file) => [file.path, file]));
    this.knownTrashPaths = new Set(byPath.keys());

    const assigned = new Set<string>();
    const retained: TrashRecord[] = [];
    for (const record of this.records) {
      if (record.trashPath && byPath.has(record.trashPath)) {
        const info = byPath.get(record.trashPath);
        if (info) {
          record.size = info.size;
          assigned.add(record.trashPath);
          retained.push(record);
        }
        continue;
      }

      if (!record.trashPath) {
        const match = await this.findPendingMatch(files.filter((file) => !assigned.has(file.path)), record);
        if (match) {
          record.trashPath = match.path;
          record.size = match.size;
          assigned.add(match.path);
          retained.push(record);
        }
      }
    }

    for (const file of files) {
      if (assigned.has(file.path)) continue;
      const inferred = this.inferOriginalPath(file.path);
      retained.push({
        id: uniqueId(),
        originalPath: inferred,
        originalPathConfidence: inferred ? "inferred" : "unknown",
        trashPath: file.path,
        fileName: fileNameFromPath(file.path),
        extension: extensionFromName(file.path),
        size: file.size,
        trashedAt: file.mtime || Date.now(),
        originalMtime: file.mtime || Date.now(),
        reason: this.t("discoveredReason"),
        source: "discovered"
      });
    }

    this.records = retained;
    await this.persistRecords();
  }

  async restore(record: TrashRecord, behavior: ConflictBehavior, recoveryFolder: string): Promise<string | null> {
    const data = await this.read(record);
    const requestedTarget = this.getRestoreTarget(record, recoveryFolder);
    const target = this.resolveRestoreTarget(requestedTarget, behavior);
    if (!target) return null;

    await this.ensureVisibleParent(target);
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing instanceof TFolder) throw new Error(this.t("cannotRestoreOverFolder", { path: target }));

    const options = record.originalMtime > 0 ? { mtime: record.originalMtime } : undefined;
    if (existing instanceof TFile && behavior === "overwrite") {
      await this.app.vault.modifyBinary(existing, data, options);
    } else if (!existing) {
      await this.app.vault.createBinary(target, data, options);
    } else {
      throw new Error(this.t("fileAlreadyExists", { path: target }));
    }

    await this.removeTrashFile(record);
    return target;
  }

  async permanentlyDelete(record: TrashRecord): Promise<void> {
    await this.removeTrashFile(record);
  }

  private async removeTrashFile(record: TrashRecord): Promise<void> {
    if (record.trashPath && await this.app.vault.adapter.exists(record.trashPath)) {
      await this.app.vault.adapter.remove(record.trashPath);
      await this.removeEmptyTrashParents(record.trashPath);
    }
    this.records = this.records.filter((item) => item.id !== record.id);
    if (record.trashPath) this.knownTrashPaths.delete(record.trashPath);
    await this.persistRecords();
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
      if (!existing) await this.app.vault.createFolder(current);
      else if (!(existing instanceof TFolder)) throw new Error(this.t("cannotCreateFolder", { path: current }));
    }
  }

  private async snapshotTrash(): Promise<Map<string, TrashSnapshotEntry>> {
    const files = await listAdapterFilesRecursively(this.app.vault.adapter, OBSIDIAN_TRASH_ROOT);
    return new Map(files.map((file) => [file.path, { size: file.size, mtime: file.mtime }]));
  }

  private async identifyMovedPath(before: Map<string, TrashSnapshotEntry>, record: TrashRecord): Promise<string | null> {
    const files = await listAdapterFilesRecursively(this.app.vault.adapter, OBSIDIAN_TRASH_ROOT);
    const changed = files.filter((file) => {
      const previous = before.get(file.path);
      return !previous || previous.size !== file.size || previous.mtime !== file.mtime;
    });
    const candidates = changed.filter((file) => file.size === record.size);
    const metadataMatch = this.bestMetadataMatch(candidates, {
      path: record.originalPath ?? record.fileName,
      name: record.fileName,
      extension: record.extension,
      size: record.size,
      mtime: record.originalMtime
    });
    if (metadataMatch && candidates.length === 1) return metadataMatch.path;

    if (record.fingerprint) {
      const ordered = metadataMatch
        ? [metadataMatch, ...candidates.filter((candidate) => candidate.path !== metadataMatch.path)]
        : candidates;
      for (const candidate of ordered) {
        try {
          const data = await this.app.vault.adapter.readBinary(candidate.path);
          if (fingerprintBinary(data) === record.fingerprint) return candidate.path;
        } catch {
          // Continue checking other candidates.
        }
      }
    }
    return metadataMatch?.path ?? null;
  }

  private bestMetadataMatch<T extends { path: string; size: number; mtime: number }>(
    candidates: T[],
    original: DeletedFileSnapshot
  ): T | null {
    const sameSize = candidates.filter((candidate) => candidate.size === original.size);
    if (sameSize.length === 0) return null;
    const originalName = original.name.toLocaleLowerCase();
    const originalStem = originalName.replace(/\.[^.]+$/, "");
    const scored = sameSize.map((candidate) => {
      const candidateName = fileNameFromPath(candidate.path).toLocaleLowerCase();
      let score = 0;
      if (candidateName === originalName) score += 10;
      if (candidateName.includes(originalStem)) score += 5;
      if (extensionFromName(candidateName) === original.extension) score += 3;
      if (normalizePath(candidate.path).endsWith(`/${normalizePath(original.path)}`)) score += 8;
      if (Math.abs(candidate.mtime - original.mtime) < 5_000) score += 2;
      return { candidate, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.candidate ?? null;
  }

  private async findPendingMatch(candidates: Array<{ path: string; size: number; mtime: number }>, record: TrashRecord) {
    const sameSize = candidates.filter((candidate) => candidate.size === record.size);
    if (record.fingerprint) {
      for (const candidate of sameSize) {
        try {
          const data = await this.app.vault.adapter.readBinary(candidate.path);
          if (fingerprintBinary(data) === record.fingerprint) return candidate;
        } catch {
          // Continue.
        }
      }
    }
    return this.bestMetadataMatch(sameSize, {
      path: record.originalPath ?? record.fileName,
      name: record.fileName,
      extension: record.extension,
      size: record.size,
      mtime: record.originalMtime
    });
  }

  private inferOriginalPath(trashPath: string): string | null {
    const prefix = `${OBSIDIAN_TRASH_ROOT}/`;
    if (!trashPath.startsWith(prefix)) return null;
    const relative = normalizePath(trashPath.slice(prefix.length));
    if (!relative.includes("/")) return null;
    if (relative.startsWith("Safe Attachment Trash Legacy/")) return null;
    return relative;
  }

  private normalizeRecord(record: TrashRecord): TrashRecord | null {
    if (!record || typeof record.id !== "string" || typeof record.fileName !== "string") return null;
    return {
      ...record,
      originalPath: typeof record.originalPath === "string" ? normalizePath(record.originalPath) : null,
      originalPathConfidence: record.originalPathConfidence === "known" || record.originalPathConfidence === "inferred"
        ? record.originalPathConfidence
        : "unknown",
      trashPath: typeof record.trashPath === "string" ? normalizePath(record.trashPath) : null,
      source: record.source === "plugin" || record.source === "observed" || record.source === "legacy"
        ? record.source
        : "discovered"
    };
  }

  private async migrateLegacyTrash(): Promise<MigrationResult> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(LEGACY_TRASH_ROOT))) return { migrated: 0, failed: 0 };

    const legacyRecords = await this.loadLegacyRecords();
    if (legacyRecords.length === 0) return { migrated: 0, failed: 0 };
    await ensureAdapterFolder(adapter, OBSIDIAN_TRASH_ROOT);
    const migrationFolder = normalizePath(`${OBSIDIAN_TRASH_ROOT}/Safe Attachment Trash Legacy`);
    await ensureAdapterFolder(adapter, migrationFolder);

    let migrated = 0;
    let failed = 0;
    for (const legacy of legacyRecords) {
      if (this.records.some((record) => record.id === legacy.id && record.trashPath)) continue;
      try {
        if (!(await adapter.exists(legacy.storedPath))) continue;
        const desired = normalizePath(`${migrationFolder}/${legacy.id}--${sanitizeStoredName(legacy.fileName)}`);
        const target = await makeUniqueAdapterPath(adapter, desired);
        await adapter.rename(legacy.storedPath, target);
        const migratedRecord: TrashRecord = {
          id: legacy.id || uniqueId(),
          originalPath: normalizePath(legacy.originalPath),
          originalPathConfidence: "known",
          trashPath: target,
          fileName: legacy.fileName,
          extension: legacy.extension.toLowerCase(),
          size: legacy.size,
          trashedAt: legacy.trashedAt,
          originalMtime: legacy.originalMtime,
          reason: legacy.reason || this.t("legacyReason"),
          source: "legacy"
        };
        this.records = this.records.filter((record) => record.id !== migratedRecord.id);
        this.records.push(migratedRecord);
        migrated += 1;
        await this.persistRecords();
      } catch {
        failed += 1;
      }
    }

    if (failed === 0) {
      try {
        await adapter.rmdir(LEGACY_TRASH_ROOT, true);
      } catch {
        // The files are already migrated; leave any unrecognized legacy leftovers untouched.
      }
    }
    return { migrated, failed };
  }

  private async loadLegacyRecords(): Promise<LegacyTrashRecord[]> {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(LEGACY_TRASH_INDEX)) {
      try {
        const parsed = JSON.parse(await adapter.read(LEGACY_TRASH_INDEX)) as LegacyTrashIndex;
        if (Array.isArray(parsed.records)) return parsed.records;
      } catch {
        // Fall back to metadata sidecars.
      }
    }

    const recovered: LegacyTrashRecord[] = [];
    const metaFolder = normalizePath(`${LEGACY_TRASH_ROOT}/meta`);
    if (!(await adapter.exists(metaFolder))) return recovered;
    const files = await listAdapterFilesRecursively(adapter, metaFolder);
    for (const file of files.filter((item) => item.path.endsWith(".json"))) {
      try {
        const record = JSON.parse(await adapter.read(file.path)) as LegacyTrashRecord;
        if (record?.id && record?.storedPath) recovered.push(record);
      } catch {
        // Ignore invalid sidecars.
      }
    }
    return recovered;
  }

  private async removeEmptyTrashParents(filePath: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    let folder = normalizePath(filePath.slice(0, filePath.lastIndexOf("/")));
    while (folder && folder !== OBSIDIAN_TRASH_ROOT && folder.startsWith(`${OBSIDIAN_TRASH_ROOT}/`)) {
      try {
        const listing = await adapter.list(folder);
        if (listing.files.length > 0 || listing.folders.length > 0) break;
        await adapter.rmdir(folder, false);
      } catch {
        break;
      }
      const slash = folder.lastIndexOf("/");
      folder = slash > 0 ? folder.slice(0, slash) : "";
    }
  }

  private async persistRecords(): Promise<void> {
    await this.persist(this.exportRecords());
  }
}
