export type ConflictBehavior = "rename" | "skip" | "overwrite";
export type LanguageMode = "auto" | "fa" | "en";
export type TrashRecordSource = "plugin" | "observed" | "discovered" | "legacy";
export type OriginalPathConfidence = "known" | "inferred" | "unknown";

export interface SafeTrashSettings {
  language: LanguageMode;
  autoScanOnPanelOpen: boolean;
  extensions: string;
  excludedFolders: string;
  minimumAgeHours: number;
  conflictBehavior: ConflictBehavior;
  scanCanvasFiles: boolean;
  recoveryFolder: string;
}

export interface ProtectedFileRecord {
  path: string;
  addedAt: number;
}

export interface TrashRecord {
  id: string;
  originalPath: string | null;
  originalPathConfidence: OriginalPathConfidence;
  trashPath: string | null;
  fileName: string;
  extension: string;
  size: number;
  trashedAt: number;
  originalMtime: number;
  reason: string;
  source: TrashRecordSource;
  fingerprint?: string;
}

export interface PersistedPluginData {
  schemaVersion: 3;
  settings: SafeTrashSettings;
  records: TrashRecord[];
  protectedFiles: ProtectedFileRecord[];
}

export interface LegacyTrashRecord {
  id: string;
  originalPath: string;
  storedPath: string;
  metadataPath?: string;
  fileName: string;
  extension: string;
  size: number;
  trashedAt: number;
  originalMtime: number;
  reason: string;
}

export interface LegacyTrashIndex {
  version: number;
  records: LegacyTrashRecord[];
}

export interface ScanCandidate {
  path: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
}

export interface AdapterFileInfo {
  path: string;
  size: number;
  mtime: number;
}
