import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { TrashRecord } from "./types";
import { formatBytes, formatDate } from "./utils";
import { ConfirmModal } from "./modals";

export const VIEW_TYPE_SAFE_TRASH = "safe-attachment-trash-view";

export class SafeTrashView extends ItemView {
  private selectedIds = new Set<string>();
  private searchQuery = "";

  constructor(leaf: WorkspaceLeaf, private plugin: SafeAttachmentTrashPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_SAFE_TRASH;
  }

  getDisplayText(): string {
    return this.plugin.t("safeTrash");
  }

  getIcon(): string {
    return "trash-2";
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("sat-view-root");
    await this.render();
    void this.plugin.scanUnused({ silentWhenEmpty: true });
  }

  async refresh(): Promise<void> {
    const available = new Set(this.plugin.store.list().map((item) => item.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => available.has(id)));
    await this.render();
  }

  private async render(): Promise<void> {
    const content = this.contentEl;
    content.empty();
    content.addClass("sat-view");
    content.dir = this.plugin.language === "fa" ? "rtl" : "ltr";

    const header = content.createDiv({ cls: "sat-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h3", { text: this.plugin.t("safeTrash") });
    titleWrap.createDiv({ text: this.plugin.t("subtitle"), cls: "sat-subtitle" });

    const toolbar = content.createDiv({ cls: "sat-toolbar" });
    this.addToolbarButton(toolbar, this.plugin.t("restoreSelected"), "", () => this.restoreSelected());
    this.addToolbarButton(toolbar, this.plugin.t("deleteSelected"), "mod-warning", () => this.deleteSelected());
    this.addToolbarButton(toolbar, this.plugin.t("refresh"), "", () => this.plugin.scanUnused({ silentWhenEmpty: false }));

    const pane = content.createDiv({ cls: "sat-list-pane" });
    const search = pane.createEl("input", {
      type: "search",
      placeholder: this.plugin.t("searchPlaceholder"),
      cls: "sat-search"
    });
    search.value = this.searchQuery;

    const listControls = pane.createDiv({ cls: "sat-list-controls" });
    const summary = listControls.createDiv({ cls: "sat-summary" });
    const selectAllLabel = listControls.createEl("label", { cls: "sat-select-all" });
    const selectAll = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.createSpan({ text: this.plugin.t("selectAll") });

    const listHost = pane.createDiv({ cls: "sat-record-list" });

    const updateSelectionControls = () => {
      const filtered = this.filteredRecords();
      summary.setText(this.plugin.t("shownSelected", {
        shown: filtered.length,
        selected: this.selectedIds.size
      }));

      const selectedVisible = filtered.filter((record) => this.selectedIds.has(record.id)).length;
      selectAll.checked = filtered.length > 0 && selectedVisible === filtered.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < filtered.length;
      selectAll.disabled = filtered.length === 0;
    };

    const renderList = () => {
      const filtered = this.filteredRecords();
      updateSelectionControls();
      listHost.empty();
      if (filtered.length === 0) {
        listHost.createDiv({ text: this.plugin.t("trashEmpty"), cls: "sat-empty" });
        return;
      }
      for (const record of filtered) this.renderRecord(listHost, record, updateSelectionControls);
    };

    search.addEventListener("input", () => {
      this.searchQuery = search.value;
      renderList();
    });

    selectAll.addEventListener("change", () => {
      const filtered = this.filteredRecords();
      if (selectAll.checked) {
        for (const record of filtered) this.selectedIds.add(record.id);
      } else {
        for (const record of filtered) this.selectedIds.delete(record.id);
      }
      renderList();
    });

    renderList();
  }

  private filteredRecords(): TrashRecord[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    const records = this.plugin.store.list();
    if (!query) return records;
    return records.filter((record) =>
      `${record.fileName} ${record.originalPath} ${record.reason}`.toLocaleLowerCase().includes(query)
    );
  }

  private renderRecord(parent: HTMLElement, record: TrashRecord, onSelectionChange: () => void): void {
    const row = parent.createDiv({ cls: "sat-record" });
    const select = row.createEl("input", { type: "checkbox", cls: "sat-record-checkbox" });
    select.checked = this.selectedIds.has(record.id);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      if (select.checked) this.selectedIds.add(record.id);
      else this.selectedIds.delete(record.id);
      onSelectionChange();
    });

    const details = row.createDiv({ cls: "sat-record-details" });
    details.createDiv({ text: record.fileName, cls: "sat-file-name" });
    details.createDiv({ text: record.originalPath, cls: "sat-file-path" });
    details.createDiv({
      text: `${formatBytes(record.size)} • ${formatDate(record.trashedAt, this.plugin.locale)}`,
      cls: "sat-file-meta"
    });

    const actions = row.createDiv({ cls: "sat-record-actions" });
    const restore = actions.createEl("button", { text: this.plugin.t("restore") });
    restore.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.restoreOne(record);
    });
    const remove = actions.createEl("button", { text: this.plugin.t("delete"), cls: "mod-warning" });
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      this.confirmDeleteOne(record);
    });

    row.addEventListener("click", () => void this.plugin.openTrashRecord(record.id));
  }

  private addToolbarButton(
    parent: HTMLElement,
    label: string,
    className: string,
    onClick: () => Promise<void> | void
  ): void {
    const button = parent.createEl("button", { text: label, cls: className });
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await onClick();
      } finally {
        button.disabled = false;
      }
    });
  }

  private async restoreOne(record: TrashRecord): Promise<void> {
    try {
      const restoredPath = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
      if (restoredPath) new Notice(this.plugin.t("restoreSuccess", { path: restoredPath }));
      else new Notice(this.plugin.t("restoreSkipped"));
      await this.plugin.refreshOpenViews();
    } catch (error) {
      new Notice(this.plugin.t("restoreFailed", {
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  private async restoreSelected(): Promise<void> {
    const records = [...this.selectedIds]
      .map((id) => this.plugin.store.get(id))
      .filter(Boolean) as TrashRecord[];
    if (records.length === 0) {
      new Notice(this.plugin.t("noneSelected"));
      return;
    }

    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of records) {
      try {
        const result = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior);
        if (result) restored += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }

    this.selectedIds.clear();
    new Notice(this.plugin.t("restoreResult", { restored, skipped, failed }));
    await this.plugin.refreshOpenViews();
  }

  private confirmDeleteOne(record: TrashRecord): void {
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
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }

  private deleteSelected(): void {
    const records = [...this.selectedIds]
      .map((id) => this.plugin.store.get(id))
      .filter(Boolean) as TrashRecord[];
    if (records.length === 0) {
      new Notice(this.plugin.t("noneSelected"));
      return;
    }

    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("deleteSelectedTitle"),
      this.plugin.t("deleteSelectedMessage", { count: records.length }),
      this.plugin.t("deletePermanently"),
      true,
      async () => {
        let deleted = 0;
        let failed = 0;
        for (const record of records) {
          try {
            await this.plugin.store.permanentlyDelete(record);
            deleted += 1;
          } catch {
            failed += 1;
          }
        }
        this.selectedIds.clear();
        new Notice(this.plugin.t("deleteResult", { deleted, failed }));
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }
}
