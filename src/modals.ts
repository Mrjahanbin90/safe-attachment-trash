import { App, Modal, Notice } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";

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
    confirm.addEventListener("click", () => {
      void this.handleConfirm(confirm);
    });
  }

  private async handleConfirm(confirm: HTMLButtonElement): Promise<void> {
    confirm.disabled = true;
    try {
      await this.onConfirm();
      this.close();
    } catch (error) {
      new Notice(this.plugin.t("error", { error: error instanceof Error ? error.message : String(error) }));
      confirm.disabled = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
