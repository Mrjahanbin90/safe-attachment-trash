import { App, normalizePath, TFile } from "obsidian";
import type { SafeTrashSettings, ScanCandidate } from "./types";
import { extensionSet, parseCsvList, pathIsInside } from "./utils";

export class UnusedAttachmentScanner {
  constructor(
    private app: App,
    private settings: SafeTrashSettings,
    private protectedPaths: ReadonlySet<string> = new Set<string>()
  ) {}

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
    const normalizedPath = normalizePath(file.path);
    const ext = file.extension.toLowerCase();
    if (!ext || ext === "md" || ext === "canvas" || ext === "base") return false;
    if (!(allowedExtensions.has("*") || allowedExtensions.has(ext))) return false;
    if (excludedFolders.some((folder) => pathIsInside(normalizedPath, folder))) return false;
    if (this.protectedPaths.has(normalizedPath)) return false;
    if (usedPaths.has(normalizedPath)) return false;
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
      for (const ref of refs) this.resolveReference(ref.link, note.path, used);
      this.collectStructuredReferences(cache?.frontmatter, note.path, used);
    }

    if (this.settings.scanCanvasFiles) {
      const canvases = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "canvas");
      for (const canvas of canvases) {
        try {
          const parsed: unknown = JSON.parse(await this.app.vault.cachedRead(canvas)) as unknown;
          this.collectStructuredReferences(parsed, canvas.path, used);
        } catch {
          // Ignore malformed canvas files.
        }
      }
    }

    const bases = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "base");
    for (const base of bases) {
      try {
        this.collectTextReferences(await this.app.vault.cachedRead(base), base.path, used);
      } catch {
        // Ignore unreadable Bases files.
      }
    }

    return used;
  }

  private collectStructuredReferences(value: unknown, sourcePath: string, output: Set<string>): void {
    if (typeof value === "string") {
      this.collectTextReferences(value, sourcePath, output);
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) this.collectStructuredReferences(child, sourcePath, output);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const child of Object.values(value as Record<string, unknown>)) {
      this.collectStructuredReferences(child, sourcePath, output);
    }
  }

  private collectTextReferences(text: string, sourcePath: string, output: Set<string>): void {
    const candidates = new Set<string>();
    const wikiPattern = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
    const markdownPattern = /!?\[[^\]]*\]\((?:<)?([^)>\s]+)(?:>)?(?:\s+["'][^"']*["'])?\)/g;
    const pathPattern = /(?:^|[\s"'([{=:,])([^\n\r"'()[\]{},=:]+?\.[a-zA-Z0-9]{1,10})(?=$|[\s"')\]}:,])/g;

    this.addRegexMatches(text, wikiPattern, candidates, false);
    this.addRegexMatches(text, markdownPattern, candidates, false);
    this.addRegexMatches(text, pathPattern, candidates, true);

    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length < 500 && /\.[a-zA-Z0-9]{1,10}(?:$|[#?])/.test(trimmed)) {
      candidates.add(trimmed);
    }

    for (const candidate of candidates) this.resolveReference(candidate, sourcePath, output);
  }


  private addRegexMatches(text: string, pattern: RegExp, output: Set<string>, trim: boolean): void {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match !== null) {
      const captured = match[1];
      if (typeof captured === "string" && captured.length > 0) {
        const value = trim ? captured.trim() : captured;
        if (value.length > 0) output.add(value);
      }
      if (match[0].length === 0) pattern.lastIndex += 1;
      match = pattern.exec(text);
    }
  }

  private resolveReference(rawLink: string, sourcePath: string, output: Set<string>): void {
    let link = rawLink.trim().replace(/^<|>$/g, "");
    if (!link || link.startsWith("#") || /^(?:https?|data|mailto|file):/i.test(link)) return;
    try {
      link = decodeURIComponent(link);
    } catch {
      // Keep the original string when it is not valid URI encoding.
    }
    link = link.split("|")[0]?.split("#")[0]?.split("?")[0]?.trim() ?? "";
    if (!link) return;

    const destination = this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
    if (destination) {
      output.add(normalizePath(destination.path));
      return;
    }

    const direct = this.app.vault.getFileByPath(normalizePath(link));
    if (direct) output.add(normalizePath(direct.path));
  }
}
