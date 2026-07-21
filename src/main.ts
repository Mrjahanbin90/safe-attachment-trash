import { Menu, Notice, Plugin, TFile } from "obsidian";
import { ConfirmModal, ScanReviewModal } from "./modals";
import { UnusedAttachmentScanner } from "./scanner";
import { DEFAULT_SETTINGS, SafeTrashSettingTab } from "./settings";
import { SafeTrashStore } from "./store";
import type { PersistedPluginData, SafeTrashSettings, ScanCandidate, TrashRecord } from "./types";
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
  settings: SafeTrashSettings = { ...DEFAULT_SETTINGS };
  store!: SafeTrashStore;
  private storedRecords: TrashRecord[] = [];
  private storeReady: Promise<void> = Promise.resolve();
  private saveQueue: Promise<void> = Promise.resolve();
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
    await this.loadState();
    this.store = new SafeTrashStore(
      this.app,
      async (records) => {
        this.storedRecords = records;
        await this.saveState();
      },
      (key, params) => this.t(key, params)
    );

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

    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile)) return;
      void this.storeReady
        .then(() => this.store.observeDeletion(file))
        .then(() => this.refreshOpenViews())
        .catch(() => undefined);
    }));

    this.storeReady = new Promise((resolve) => {
      this.app.workspace.onLayoutReady(() => {
        void this.initializeStore().finally(resolve);
      });
    });
  }

  async saveState(): Promise<void> {
    const snapshot: PersistedPluginData = {
      schemaVersion: 2,
      settings: { ...this.settings },
      records: this.storedRecords.map((record) => ({ ...record }))
    };
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(() => this.saveData(snapshot));
    await this.saveQueue;
  }

  async refreshLanguage(): Promise<void> {
    await this.refreshOpenViews();
  }

  async activateView(): Promise<void> {
    await this.storeReady;
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAFE_TRASH)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      await this.syncTrash();
      await this.scanUnused({ silentWhenEmpty: true });
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SAFE_TRASH, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openTrashRecord(recordId: string): Promise<void> {
    await this.storeReady;
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

  async syncTrash(): Promise<void> {
    await this.storeReady;
    await this.store.reconcile();
    await this.refreshOpenViews();
  }

  async scanUnused(options: ScanOptions = {}): Promise<void> {
    await this.storeReady;
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
          const file = this.app.vault.getFileByPath(path);
          if (!file) {
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
        await this.syncTrash();
      },
      () => {
        this.scanReviewOpen = false;
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

  private async initializeStore(): Promise<void> {
    try {
      const migration = await this.store.initialize(this.storedRecords);
      this.storedRecords = this.store.exportRecords();
      await this.saveState();
      if (migration.migrated > 0 && migration.failed === 0) new Notice(this.t("migrationComplete"));
      if (migration.failed > 0) new Notice(this.t("migrationPartial"));
    } catch (error) {
      new Notice(this.t("error", { error: error instanceof Error ? error.message : String(error) }));
    }
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
        await this.storeReady;
        await this.store.moveToTrash(file, reason);
        new Notice(this.t("moved"));
        await this.syncTrash();
      }
    ).open();
  }

  private async loadState(): Promise<void> {
    const loaded: unknown = await this.loadData();
    const root = isRecord(loaded) ? loaded : {};
    const settingsSource = root.schemaVersion === 2 && isRecord(root.settings) ? root.settings : root;
    this.settings = this.parseSettings(settingsSource);
    this.storedRecords = root.schemaVersion === 2 && Array.isArray(root.records)
      ? root.records.filter(isRecord).map((record) => record as unknown as TrashRecord)
      : [];
  }

  private parseSettings(data: Record<string, unknown>): SafeTrashSettings {
    return {
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
        : DEFAULT_SETTINGS.scanCanvasFiles,
      recoveryFolder: typeof data.recoveryFolder === "string" && data.recoveryFolder.trim()
        ? data.recoveryFolder
        : DEFAULT_SETTINGS.recoveryFolder
    };
  }
}
