export type ConflictBehavior = "rename" | "skip" | "overwrite";
export type LanguageMode = "auto" | "fa" | "en";

export interface SafeTrashSettings {
  language: LanguageMode;
  extensions: string;
  excludedFolders: string;
  minimumAgeHours: number;
  conflictBehavior: ConflictBehavior;
  scanCanvasFiles: boolean;
}

export interface TrashRecord {
  id: string;
  originalPath: string;
  storedPath: string;
  metadataPath: string;
  fileName: string;
  extension: string;
  size: number;
  trashedAt: number;
  originalMtime: number;
  reason: string;
}

export interface TrashIndex {
  version: 1;
  records: TrashRecord[];
}

export interface ScanCandidate {
  path: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
}
