import { App, Modal, Notice } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { ScanCandidate } from "./types";
import { formatBytes } from "./utils";

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private plugin: SafeAttachmentTrashPlugin,
    private titleText: string,
    private message: string,
    private confirmText: string,
    private dangerous: boolean,
    private onConfirm: () => Promise<void> | void
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    this.setTitle(this.titleText);
    const body = this.contentEl.createDiv({ cls: "sat-confirm-message" });
    body.setText(this.message);
    const actions = this.contentEl.createDiv({ cls: "sat-modal-actions" });
    const cancel = actions.createEl("button", { text: this.plugin.t("cancel") });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: this.confirmText, cls: this.dangerous ? "mod-warning" : "mod-cta" });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this.onConfirm();
        this.close();
      } catch (error) {
        new Notice(this.plugin.t("error", { error: error instanceof Error ? error.message : String(error) }));
        confirm.disabled = false;
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ScanReviewModal extends Modal {
  private selected = new Set<string>();

  constructor(
    app: App,
    private plugin: SafeAttachmentTrashPlugin,
    private candidates: ScanCandidate[],
    private onMove: (paths: string[]) => Promise<void>,
    private onClosed?: () => void
  ) {
    super(app);
    for (const candidate of candidates) this.selected.add(candidate.path);
  }

  onOpen(): void {
    this.modalEl.addClass("sat-scan-modal");
    this.modalEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";
    this.setTitle(this.plugin.t("unusedFilesTitle", { count: this.candidates.length }));
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createDiv({ text: this.plugin.t("unusedHelp"), cls: "sat-help" });

    const controls = this.contentEl.createDiv({ cls: "sat-scan-controls" });
    const selectAllLabel = controls.createEl("label", { cls: "sat-select-all" });
    const selectAll = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.createSpan({ text: this.plugin.t("selectAll") });

    const list = this.contentEl.createDiv({ cls: "sat-scan-list" });
    const checkboxes = new Map<string, HTMLInputElement>();
    for (const candidate of this.candidates) {
      const row = list.createDiv({ cls: "sat-scan-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selected.has(candidate.path);
      checkboxes.set(candidate.path, checkbox);
      const details = row.createDiv({ cls: "sat-scan-details" });
      details.createDiv({ text: candidate.name, cls: "sat-file-name" });
      details.createDiv({ text: candidate.path, cls: "sat-file-path" });
      row.createDiv({ text: formatBytes(candidate.size), cls: "sat-file-size" });
    }

    const actions = this.contentEl.createDiv({ cls: "sat-modal-actions" });
    const cancel = actions.createEl("button", { text: this.plugin.t("cancel") });
    cancel.addEventListener("click", () => this.close());
    const move = actions.createEl("button", { cls: "mod-cta" });

    const updateControls = () => {
      const allSelected = this.candidates.length > 0 && this.selected.size === this.candidates.length;
      selectAll.checked = allSelected;
      selectAll.indeterminate = this.selected.size > 0 && !allSelected;
      move.setText(this.plugin.t("moveCount", { count: this.selected.size }));
      move.disabled = this.selected.size === 0;
    };

    for (const candidate of this.candidates) {
      const checkbox = checkboxes.get(candidate.path)!;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(candidate.path);
        else this.selected.delete(candidate.path);
        updateControls();
      });
    }

    selectAll.addEventListener("change", () => {
      if (selectAll.checked) {
        this.selected = new Set(this.candidates.map((item) => item.path));
      } else {
        this.selected.clear();
      }
      for (const [path, checkbox] of checkboxes) checkbox.checked = this.selected.has(path);
      updateControls();
    });

    move.addEventListener("click", async () => {
      move.disabled = true;
      try {
        await this.onMove([...this.selected]);
        this.close();
      } catch (error) {
        new Notice(this.plugin.t("error", { error: error instanceof Error ? error.message : String(error) }));
        updateControls();
      }
    });

    updateControls();
  }

  onClose(): void {
    this.contentEl.empty();
    this.onClosed?.();
  }
}
