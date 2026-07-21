import { App, normalizePath, TFile } from "obsidian";
import type { SafeTrashSettings, ScanCandidate } from "./types";
import { extensionSet, parseCsvList, pathIsInside } from "./utils";

export class UnusedAttachmentScanner {
  constructor(private app: App, private settings: SafeTrashSettings) {}

  async scan(): Promise<ScanCandidate[]> {
    const usedPaths = await this.collectUsedPaths();
    const allowedExtensions = extensionSet(this.settings.extensions);
    const excludedFolders = parseCsvList(this.settings.excludedFolders).map(normalizePath);
    const cutoff = Date.now() - Math.max(0, this.settings.minimumAgeHours) * 60 * 60 * 1000;

    return this.app.vault.getFiles()
      .filter((file) => this.isCandidate(file, allowedExtensions, excludedFolders, usedPaths, cutoff))
      .map((file) => ({
        path: file.path,
        name: file.name,
        extension: file.extension.toLowerCase(),
        size: file.stat.size,
        mtime: file.stat.mtime
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private isCandidate(
    file: TFile,
    allowedExtensions: Set<string>,
    excludedFolders: string[],
    usedPaths: Set<string>,
    cutoff: number
  ): boolean {
    const ext = file.extension.toLowerCase();
    if (!ext || ext === "md" || ext === "canvas") return false;
    if (!(allowedExtensions.has("*") || allowedExtensions.has(ext))) return false;
    if (excludedFolders.some((folder) => pathIsInside(file.path, folder))) return false;
    if (usedPaths.has(normalizePath(file.path))) return false;
    if (file.stat.mtime > cutoff) return false;
    return true;
  }

  private async collectUsedPaths(): Promise<Set<string>> {
    const used = new Set<string>();
    const resolved = this.app.metadataCache.resolvedLinks ?? {};
    for (const targets of Object.values(resolved)) {
      for (const [targetPath, count] of Object.entries(targets)) {
        if (count > 0) used.add(normalizePath(targetPath));
      }
    }

    for (const note of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(note);
      const refs = [...(cache?.links ?? []), ...(cache?.embeds ?? [])];
      for (const ref of refs) {
        const destination = this.app.metadataCache.getFirstLinkpathDest(ref.link, note.path);
        if (destination) used.add(normalizePath(destination.path));
      }
    }

    if (this.settings.scanCanvasFiles) {
      const canvases = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "canvas");
      for (const canvas of canvases) {
        try {
          const parsed: unknown = JSON.parse(await this.app.vault.cachedRead(canvas)) as unknown;
          this.collectCanvasPaths(parsed, used);
        } catch {
          // Ignore malformed canvas files.
        }
      }
    }
    return used;
  }

  private collectCanvasPaths(value: unknown, output: Set<string>): void {
    if (Array.isArray(value)) {
      for (const child of value) this.collectCanvasPaths(child, output);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "file" && typeof child === "string") {
        output.add(normalizePath(child));
      } else {
        this.collectCanvasPaths(child, output);
      }
    }
  }
}
