import { Menu, Notice, Plugin, TFile } from "obsidian";
import { ConfirmModal, ScanReviewModal } from "./modals";
import { UnusedAttachmentScanner } from "./scanner";
import { DEFAULT_SETTINGS, SafeTrashSettingTab } from "./settings";
import { SafeTrashStore } from "./store";
import type { SafeTrashSettings, ScanCandidate } from "./types";
import { SafeTrashView, VIEW_TYPE_SAFE_TRASH } from "./view";
import { SafeTrashPreviewView, VIEW_TYPE_SAFE_TRASH_PREVIEW } from "./preview";
import { resolveLanguage, translate } from "./i18n";
import type { AppLanguage, TranslationKey } from "./i18n";

interface ScanOptions {
  silentWhenEmpty?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default class SafeAttachmentTrashPlugin extends Plugin {
  settings: SafeTrashSettings = DEFAULT_SETTINGS;
  store!: SafeTrashStore;
  private scanInProgress = false;
  private scanReviewOpen = false;

  get language(): AppLanguage {
    return resolveLanguage(this.settings.language);
  }

  get locale(): string {
    return this.language === "fa" ? "fa-IR" : "en-US";
  }

  t(key: TranslationKey, params: Record<string, string | number> = {}): string {
    return translate(this.language, key, params);
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new SafeTrashStore(this.app, (key, params) => this.t(key, params));
    await this.store.initialize();

    this.registerView(VIEW_TYPE_SAFE_TRASH, (leaf) => new SafeTrashView(leaf, this));
    this.registerView(VIEW_TYPE_SAFE_TRASH_PREVIEW, (leaf) => new SafeTrashPreviewView(leaf, this));
    this.addSettingTab(new SafeTrashSettingTab(this.app, this));

    this.addRibbonIcon("trash-2", this.t("openSafeTrash"), () => void this.activateView());

    this.addCommand({
      id: "open-safe-trash",
      name: this.t("openSafeTrash"),
      callback: () => void this.activateView()
    });

    this.addCommand({
      id: "scan-unused-attachments",
      name: this.t("scanUnusedCommand"),
      callback: () => void this.scanUnused({ silentWhenEmpty: false })
    });

    this.addCommand({
      id: "move-active-file-to-safe-trash",
      name: this.t("moveCurrentFile"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.confirmMoveFile(file, this.t("manualReason"));
        return true;
      }
    });

    this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file) => {
      if (!(file instanceof TFile)) return;
      menu.addItem((item) => item
        .setTitle(this.t("moveToSafeTrash"))
        .setIcon("trash-2")
        .onClick(() => this.confirmMoveFile(file, this.t("manualReason"))));
    }));
  }


  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    const data = isRecord(loaded) ? loaded : {};
    this.settings = {
      language: data.language === "fa" || data.language === "en" || data.language === "auto"
        ? data.language
        : DEFAULT_SETTINGS.language,
      extensions: typeof data.extensions === "string" ? data.extensions : DEFAULT_SETTINGS.extensions,
      excludedFolders: typeof data.excludedFolders === "string"
        ? data.excludedFolders
        : DEFAULT_SETTINGS.excludedFolders,
      minimumAgeHours: typeof data.minimumAgeHours === "number" && Number.isFinite(data.minimumAgeHours)
        ? Math.max(0, data.minimumAgeHours)
        : DEFAULT_SETTINGS.minimumAgeHours,
      conflictBehavior: data.conflictBehavior === "rename" || data.conflictBehavior === "skip" || data.conflictBehavior === "overwrite"
        ? data.conflictBehavior
        : DEFAULT_SETTINGS.conflictBehavior,
      scanCanvasFiles: typeof data.scanCanvasFiles === "boolean"
        ? data.scanCanvasFiles
        : DEFAULT_SETTINGS.scanCanvasFiles
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async refreshLanguage(): Promise<void> {
    await this.refreshOpenViews();
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      if (existing.view instanceof SafeTrashView) await existing.view.refresh();
      await this.scanUnused({ silentWhenEmpty: true });
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SAFE_TRASH, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openTrashRecord(recordId: string): Promise<void> {
    const record = this.store.get(recordId);
    if (!record) return;

    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH_PREVIEW)
      .find((leaf) => (leaf.getViewState().state as { recordId?: string } | undefined)?.recordId === recordId);
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_SAFE_TRASH_PREVIEW,
      active: true,
      state: { recordId }
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  async scanUnused(options: ScanOptions = {}): Promise<void> {
    if (this.scanInProgress || this.scanReviewOpen) return;
    this.scanInProgress = true;
    if (!options.silentWhenEmpty) new Notice(this.t("scanning"));

    let candidates: ScanCandidate[];
    try {
      const scanner = new UnusedAttachmentScanner(this.app, this.settings);
      candidates = await scanner.scan();
    } catch (error) {
      new Notice(this.t("error", { error: error instanceof Error ? error.message : String(error) }));
      return;
    } finally {
      this.scanInProgress = false;
    }

    if (candidates.length === 0) {
      if (!options.silentWhenEmpty) new Notice(this.t("noUnused"));
      await this.refreshOpenViews();
      return;
    }

    this.scanReviewOpen = true;
    new ScanReviewModal(
      this.app,
      this,
      candidates,
      async (paths) => {
        let moved = 0;
        let failed = 0;
        for (const path of paths) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) {
            failed += 1;
            continue;
          }
          try {
            await this.store.moveToTrash(file, this.t("unusedReason"));
            moved += 1;
          } catch {
            failed += 1;
          }
        }
        new Notice(this.t("moveResult", { moved, failed }));
        await this.refreshOpenViews();
      },
      () => {
        this.scanReviewOpen = false;
      }
    ).open();
  }

  private confirmMoveFile(file: TFile, reason: string): void {
    new ConfirmModal(
      this.app,
      this,
      this.t("moveFileTitle"),
      this.t("moveFileMessage", { path: file.path }),
      this.t("move"),
      false,
      async () => {
        await this.store.moveToTrash(file, reason);
        new Notice(this.t("moved"));
        await this.refreshOpenViews();
      }
    ).open();
  }

  async refreshOpenViews(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH)) {
      if (leaf.view instanceof SafeTrashView) await leaf.view.refresh();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH_PREVIEW)) {
      if (leaf.view instanceof SafeTrashPreviewView) await leaf.view.refresh();
    }
  }
}
