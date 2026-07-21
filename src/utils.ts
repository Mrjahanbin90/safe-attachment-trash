import { normalizePath } from "obsidian";
import type { DataAdapter } from "obsidian";
import type { AdapterFileInfo } from "./types";

export const OBSIDIAN_TRASH_ROOT = normalizePath(".trash");
export const LEGACY_TRASH_ROOT = normalizePath(".safe-attachment-trash");
export const LEGACY_TRASH_INDEX = normalizePath(`${LEGACY_TRASH_ROOT}/index.json`);
export const LEGACY_TRASH_META = normalizePath(`${LEGACY_TRASH_ROOT}/meta`);

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

export function fileNameFromPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function extensionFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
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
    if (!(await adapter.exists(current))) await adapter.mkdir(current);
  }
}

export async function listAdapterFilesRecursively(adapter: DataAdapter, root: string): Promise<AdapterFileInfo[]> {
  const normalizedRoot = normalizePath(root);
  if (!(await adapter.exists(normalizedRoot))) return [];

  const files: AdapterFileInfo[] = [];
  const queue = [normalizedRoot];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const folder = queue.shift();
    if (!folder || visited.has(folder)) continue;
    visited.add(folder);
    const listing = await adapter.list(folder);
    for (const path of listing.files) {
      const normalizedPath = normalizePath(path);
      const stat = await adapter.stat(normalizedPath);
      if (stat?.type === "file") files.push({ path: normalizedPath, size: stat.size, mtime: stat.mtime });
    }
    for (const path of listing.folders) queue.push(normalizePath(path));
  }
  return files;
}

export function fingerprintBinary(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 65536));
  for (let index = 0; index < bytes.length; index += step) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${bytes.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function makeUniqueAdapterPath(adapter: DataAdapter, desiredPath: string): Promise<string> {
  const normalized = normalizePath(desiredPath);
  if (!(await adapter.exists(normalized))) return normalized;
  const slash = normalized.lastIndexOf("/");
  const folder = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 1;
  while (await adapter.exists(`${folder}${base} ${index}${extension}`)) index += 1;
  return normalizePath(`${folder}${base} ${index}${extension}`);
}

export function uniqueId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
