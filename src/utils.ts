import { normalizePath } from "obsidian";
import type { DataAdapter } from "obsidian";

export const TRASH_ROOT = normalizePath(".safe-attachment-trash");
export const TRASH_FILES = normalizePath(`${TRASH_ROOT}/files`);
export const TRASH_META = normalizePath(`${TRASH_ROOT}/meta`);
export const TRASH_INDEX = normalizePath(`${TRASH_ROOT}/index.json`);

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
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

export function formatDate(timestamp: number, locale = "en-US"): string {
  if (!timestamp) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function parseCsvList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extensionSet(value: string): Set<string> {
  return new Set(parseCsvList(value).map((ext) => ext.replace(/^\./, "").toLowerCase()));
}

export function pathIsInside(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder).replace(/\/$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

export function sanitizeStoredName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 160) || "file";
}

export function mimeForExtension(extension: string): string {
  const ext = extension.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", avif: "image/avif",
    pdf: "application/pdf",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4",
    txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
    yaml: "text/yaml", yml: "text/yaml", xml: "application/xml", log: "text/plain",
    css: "text/css", js: "text/javascript", ts: "text/typescript"
  };
  return map[ext] ?? "application/octet-stream";
}

export function isTextExtension(extension: string): boolean {
  return new Set(["txt", "md", "csv", "json", "yaml", "yml", "xml", "log", "css", "js", "ts"]).has(extension.toLowerCase());
}

export function isImageExtension(extension: string): boolean {
  return new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"]).has(extension.toLowerCase());
}

export function isAudioExtension(extension: string): boolean {
  return new Set(["mp3", "wav", "ogg", "m4a", "flac"]).has(extension.toLowerCase());
}

export function isVideoExtension(extension: string): boolean {
  return new Set(["mp4", "webm", "mov", "m4v"]).has(extension.toLowerCase());
}

export async function ensureAdapterFolder(adapter: DataAdapter, folderPath: string): Promise<void> {
  const parts = normalizePath(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await adapter.exists(current))) {
      await adapter.mkdir(current);
    }
  }
}

export function uniqueId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}
