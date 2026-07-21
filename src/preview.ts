import { ItemView, Notice, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { TrashRecord } from "./types";
import {
  formatBytes,
  formatDate,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isVideoExtension,
  mimeForExtension
} from "./utils";
import { ConfirmModal } from "./modals";

export const VIEW_TYPE_SAFE_TRASH_PREVIEW = "safe-attachment-trash-preview";

export class SafeTrashPreviewView extends ItemView {
  private recordId: string | null = null;
  private objectUrl: string | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: SafeAttachmentTrashPlugin) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return VIEW_TYPE_SAFE_TRASH_PREVIEW;
  }

  getDisplayText(): string {
    const record = this.recordId ? this.plugin.store.get(this.recordId) : undefined;
    return record?.fileName ?? this.plugin.t("safeTrash");
  }

  getIcon(): string {
    return "file-search";
  }

  getState(): Record<string, unknown> {
    return { recordId: this.recordId };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const candidate = state as { recordId?: unknown } | null;
    this.recordId = typeof candidate?.recordId === "string" ? candidate.recordId : null;
    await this.render();
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("sat-preview-view-root");
    await this.render();
  }

  async onClose(): Promise<void> {
    this.releaseObjectUrl();
  }

  async refresh(): Promise<void> {
    await this.render();
  }

  private async render(): Promise<void> {
    this.releaseObjectUrl();
    const content = this.contentEl;
    content.empty();
    content.addClass("sat-file-view");
    content.dir = this.plugin.language === "fa" ? "rtl" : "ltr";

    const record = this.recordId ? this.plugin.store.get(this.recordId) : undefined;
    if (!record) {
      const empty = content.createDiv({ cls: "sat-file-view-empty" });
      empty.createEl("h3", { text: this.plugin.t("recordMissingTitle") });
      empty.createDiv({ text: this.plugin.t("recordMissingBody"), cls: "sat-subtitle" });
      return;
    }

    const header = content.createDiv({ cls: "sat-file-view-header" });
    const info = header.createDiv({ cls: "sat-file-view-info" });
    info.createEl("h3", { text: record.fileName });
    info.createDiv({ text: record.originalPath, cls: "sat-file-path" });
    const meta = info.createDiv({ cls: "sat-preview-meta" });
    meta.createDiv({ text: this.plugin.t("size", { value: formatBytes(record.size) }) });
    meta.createDiv({ text: this.plugin.t("movedAt", { value: formatDate(record.trashedAt, this.plugin.locale) }) });
    meta.createDiv({ text: this.plugin.t("reason", { value: record.reason }) });

    const actions = header.createDiv({ cls: "sat-preview-actions" });
    const restore = actions.createEl("button", { text: this.plugin.t("restore"), cls: "mod-cta" });
    restore.addEventListener("click", () => void this.restore(record));
    const remove = actions.createEl("button", { text: this.plugin.t("deletePermanently"), cls: "mod-warning" });
    remove.addEventListener("click", () => this.confirmDelete(record));

    const body = content.createDiv({ cls: "sat-file-view-body" });
    try {
      const data = await this.plugin.store.read(record);
      const extension = record.extension.toLowerCase();
      if (isTextExtension(extension)) {
        const text = new TextDecoder("utf-8").decode(data);
        body.createEl("pre", { text: text.slice(0, 500_000), cls: "sat-text-preview" });
        if (text.length > 500_000) {
          body.createDiv({ text: this.plugin.t("previewLimited"), cls: "sat-help" });
        }
        return;
      }

      const blob = new Blob([data], { type: mimeForExtension(extension) });
      this.objectUrl = URL.createObjectURL(blob);
      if (isImageExtension(extension)) {
        const image = body.createEl("img", { cls: "sat-image-preview" });
        image.src = this.objectUrl;
      } else if (extension === "pdf") {
        const frame = body.createEl("iframe", { cls: "sat-pdf-preview" });
        frame.src = this.objectUrl;
        frame.setAttr("title", record.fileName);
      } else if (isAudioExtension(extension)) {
        const audio = body.createEl("audio", { cls: "sat-media-preview" });
        audio.controls = true;
        audio.src = this.objectUrl;
      } else if (isVideoExtension(extension)) {
        const video = body.createEl("video", { cls: "sat-media-preview" });
        video.controls = true;
        video.src = this.objectUrl;
      } else {
        body.createDiv({ text: this.plugin.t("previewUnavailable"), cls: "sat-empty" });
      }
    } catch (error) {
      body.createDiv({
        text: this.plugin.t("previewFailed", { error: error instanceof Error ? error.message : String(error) }),
        cls: "sat-error"
      });
    }
  }

  private async restore(record: TrashRecord): Promise<void> {
    try {
      const restoredPath = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
      if (restoredPath) {
        new Notice(this.plugin.t("restoreSuccess", { path: restoredPath }));
        this.leaf.detach();
      } else {
        new Notice(this.plugin.t("restoreSkipped"));
      }
      await this.plugin.refreshOpenViews();
    } catch (error) {
      new Notice(this.plugin.t("restoreFailed", {
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  private confirmDelete(record: TrashRecord): void {
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("deleteFileTitle"),
      this.plugin.t("deleteFileMessage", { name: record.fileName }),
      this.plugin.t("deletePermanently"),
      true,
      async () => {
        await this.plugin.store.permanentlyDelete(record);
        new Notice(this.plugin.t("fileDeleted"));
        this.leaf.detach();
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
