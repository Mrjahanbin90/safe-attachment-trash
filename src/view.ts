import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { ProtectedFileRecord, ScanCandidate, TrashRecord } from "./types";
import { formatBytes, formatDate } from "./utils";
import { ConfirmModal } from "./modals";

export const VIEW_TYPE_SAFE_TRASH = "safe-attachment-trash-view";
type Section = "unused" | "trash" | "protected";

export class SafeTrashView extends ItemView {
  private activeSection: Section = "unused";
  private selectedCandidatePaths = new Set<string>();
  private selectedTrashIds = new Set<string>();
  private selectedProtectedPaths = new Set<string>();
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
    this.render();
    await this.plugin.syncTrash();
    if (this.plugin.settings.autoScanOnPanelOpen) {
      await this.plugin.scanUnused({ silentWhenEmpty: true });
    }
  }

  async refresh(): Promise<void> {
    const candidatePaths = new Set(this.plugin.getScanCandidates().map((item) => item.path));
    this.selectedCandidatePaths = new Set([...this.selectedCandidatePaths].filter((path) => candidatePaths.has(path)));

    const trashIds = new Set(this.plugin.store.list().map((item) => item.id));
    this.selectedTrashIds = new Set([...this.selectedTrashIds].filter((id) => trashIds.has(id)));

    const protectedPaths = new Set(this.plugin.getProtectedFiles().map((item) => item.path));
    this.selectedProtectedPaths = new Set([...this.selectedProtectedPaths].filter((path) => protectedPaths.has(path)));
    this.render();
  }

  private render(): void {
    const content = this.contentEl;
    content.empty();
    content.addClass("sat-view");
    content.dir = this.plugin.language === "fa" ? "rtl" : "ltr";

    const header = content.createDiv({ cls: "sat-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h3", { text: this.plugin.t("safeTrash") });
    titleWrap.createDiv({ text: this.plugin.t("subtitle"), cls: "sat-subtitle" });

    const tabs = content.createDiv({ cls: "sat-tabs" });
    this.addTab(tabs, "unused", this.plugin.t("unusedTab", { count: this.plugin.getScanCandidates().length }));
    this.addTab(tabs, "trash", this.plugin.t("trashTab", { count: this.plugin.store.list().length }));
    this.addTab(tabs, "protected", this.plugin.t("protectedTab", { count: this.plugin.getProtectedFiles().length }));

    const toolbar = content.createDiv({ cls: "sat-toolbar" });
    this.renderSectionActions(toolbar);
    this.addToolbarButton(toolbar, this.plugin.t("scanAndRefresh"), "", async () => {
      await this.plugin.syncTrash();
      await this.plugin.scanUnused({ silentWhenEmpty: false });
    });

    if (this.plugin.isScanning) {
      content.createDiv({ text: this.plugin.t("scanning"), cls: "sat-scan-status" });
    } else if (this.plugin.lastScanAt) {
      content.createDiv({
        text: this.plugin.t("lastScan", { value: formatDate(this.plugin.lastScanAt, this.plugin.locale) }),
        cls: "sat-scan-status"
      });
    } else if (!this.plugin.settings.autoScanOnPanelOpen) {
      content.createDiv({ text: this.plugin.t("manualScanHint"), cls: "sat-scan-status" });
    }

    const pane = content.createDiv({ cls: "sat-list-pane" });
    const search = pane.createEl("input", {
      type: "search",
      placeholder: this.searchPlaceholder(),
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
      const shown = this.filteredItemCount();
      const selectedVisible = this.selectedVisibleCount();
      summary.setText(this.plugin.t("shownSelected", { shown, selected: this.selectedCount() }));
      selectAll.checked = shown > 0 && selectedVisible === shown;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < shown;
      selectAll.disabled = shown === 0;
    };

    const renderList = () => {
      listHost.empty();
      updateSelectionControls();
      if (this.activeSection === "unused") this.renderUnusedList(listHost, updateSelectionControls);
      else if (this.activeSection === "trash") this.renderTrashList(listHost, updateSelectionControls);
      else this.renderProtectedList(listHost, updateSelectionControls);
    };

    search.addEventListener("input", () => {
      this.searchQuery = search.value;
      renderList();
    });

    selectAll.addEventListener("change", () => {
      this.setAllVisibleSelected(selectAll.checked);
      renderList();
    });

    renderList();
  }

  private addTab(parent: HTMLElement, section: Section, label: string): void {
    const button = parent.createEl("button", { text: label, cls: "sat-tab" });
    if (this.activeSection === section) button.addClass("is-active");
    button.addEventListener("click", () => {
      this.activeSection = section;
      this.searchQuery = "";
      this.render();
    });
  }

  private renderSectionActions(toolbar: HTMLElement): void {
    if (this.activeSection === "unused") {
      this.addToolbarButton(toolbar, this.plugin.t("moveSelectedToTrash"), "mod-cta", async () => {
        const paths = [...this.selectedCandidatePaths];
        if (paths.length === 0) return this.noticeNoneSelected();
        await this.plugin.moveCandidates(paths);
        this.selectedCandidatePaths.clear();
      });
      this.addToolbarButton(toolbar, this.plugin.t("neverSuggestSelected"), "", async () => {
        const paths = [...this.selectedCandidatePaths];
        if (paths.length === 0) return this.noticeNoneSelected();
        await this.plugin.protectPaths(paths);
        this.selectedCandidatePaths.clear();
      });
      return;
    }

    if (this.activeSection === "trash") {
      this.addToolbarButton(toolbar, this.plugin.t("restoreSelected"), "", () => this.restoreSelected());
      this.addToolbarButton(toolbar, this.plugin.t("deleteSelected"), "mod-warning", () => this.deleteSelected());
      return;
    }

    this.addToolbarButton(toolbar, this.plugin.t("allowSelectedAgain"), "", async () => {
      const paths = [...this.selectedProtectedPaths];
      if (paths.length === 0) return this.noticeNoneSelected();
      await this.plugin.unprotectPaths(paths);
      this.selectedProtectedPaths.clear();
    });
  }

  private renderUnusedList(parent: HTMLElement, onSelectionChange: () => void): void {
    const candidates = this.filteredCandidates();
    if (candidates.length === 0) {
      parent.createDiv({
        text: this.plugin.lastScanAt ? this.plugin.t("unusedEmpty") : this.plugin.t("scanToFindUnused"),
        cls: "sat-empty"
      });
      return;
    }
    for (const candidate of candidates) this.renderCandidate(parent, candidate, onSelectionChange);
  }

  private renderCandidate(parent: HTMLElement, candidate: ScanCandidate, onSelectionChange: () => void): void {
    const row = parent.createDiv({ cls: "sat-record" });
    const select = row.createEl("input", { type: "checkbox", cls: "sat-record-checkbox" });
    select.checked = this.selectedCandidatePaths.has(candidate.path);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      if (select.checked) this.selectedCandidatePaths.add(candidate.path);
      else this.selectedCandidatePaths.delete(candidate.path);
      onSelectionChange();
    });

    const details = row.createDiv({ cls: "sat-record-details" });
    details.createDiv({ text: candidate.name, cls: "sat-file-name" });
    details.createDiv({ text: candidate.path, cls: "sat-file-path" });
    details.createDiv({
      text: `${formatBytes(candidate.size)} • ${this.plugin.t("modifiedAt", { value: formatDate(candidate.mtime, this.plugin.locale) })}`,
      cls: "sat-file-meta"
    });

    const actions = row.createDiv({ cls: "sat-record-actions" });
    this.addRowButton(actions, this.plugin.t("open"), "", () => this.plugin.openVaultFile(candidate.path));
    this.addRowButton(actions, this.plugin.t("moveToTrash"), "mod-cta", async () => {
      await this.plugin.moveCandidates([candidate.path]);
      this.selectedCandidatePaths.delete(candidate.path);
    });
    this.addRowButton(actions, this.plugin.t("neverSuggest"), "", async () => {
      await this.plugin.protectPaths([candidate.path]);
      this.selectedCandidatePaths.delete(candidate.path);
    });

    row.addEventListener("click", () => void this.plugin.openVaultFile(candidate.path));
  }

  private renderTrashList(parent: HTMLElement, onSelectionChange: () => void): void {
    const records = this.filteredTrashRecords();
    if (records.length === 0) {
      parent.createDiv({ text: this.plugin.t("trashEmpty"), cls: "sat-empty" });
      return;
    }
    for (const record of records) this.renderTrashRecord(parent, record, onSelectionChange);
  }

  private renderTrashRecord(parent: HTMLElement, record: TrashRecord, onSelectionChange: () => void): void {
    const row = parent.createDiv({ cls: "sat-record" });
    const select = row.createEl("input", { type: "checkbox", cls: "sat-record-checkbox" });
    select.checked = this.selectedTrashIds.has(record.id);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      if (select.checked) this.selectedTrashIds.add(record.id);
      else this.selectedTrashIds.delete(record.id);
      onSelectionChange();
    });

    const details = row.createDiv({ cls: "sat-record-details" });
    details.createDiv({ text: record.fileName, cls: "sat-file-name" });
    details.createDiv({ text: record.originalPath ?? this.plugin.t("originalUnknown"), cls: "sat-file-path" });
    if (record.originalPathConfidence !== "known") {
      details.createSpan({
        text: this.plugin.t(record.originalPathConfidence === "inferred" ? "inferredPathBadge" : "unknownPathBadge"),
        cls: "sat-path-badge"
      });
    }
    details.createDiv({
      text: `${formatBytes(record.size)} • ${formatDate(record.trashedAt, this.plugin.locale)}`,
      cls: "sat-file-meta"
    });

    const actions = row.createDiv({ cls: "sat-record-actions" });
    this.addRowButton(actions, this.plugin.t("restore"), "", () => this.restoreOne(record));
    this.addRowButton(actions, this.plugin.t("delete"), "mod-warning", () => {
      this.confirmDeleteOne(record);
    });
    row.addEventListener("click", () => void this.plugin.openTrashRecord(record.id));
  }

  private renderProtectedList(parent: HTMLElement, onSelectionChange: () => void): void {
    const records = this.filteredProtectedFiles();
    if (records.length === 0) {
      parent.createDiv({ text: this.plugin.t("protectedEmpty"), cls: "sat-empty" });
      return;
    }
    for (const record of records) this.renderProtectedRecord(parent, record, onSelectionChange);
  }

  private renderProtectedRecord(parent: HTMLElement, record: ProtectedFileRecord, onSelectionChange: () => void): void {
    const row = parent.createDiv({ cls: "sat-record" });
    const select = row.createEl("input", { type: "checkbox", cls: "sat-record-checkbox" });
    select.checked = this.selectedProtectedPaths.has(record.path);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      if (select.checked) this.selectedProtectedPaths.add(record.path);
      else this.selectedProtectedPaths.delete(record.path);
      onSelectionChange();
    });

    const exists = this.app.vault.getFileByPath(record.path) !== null;
    const details = row.createDiv({ cls: "sat-record-details" });
    details.createDiv({ text: record.path.slice(record.path.lastIndexOf("/") + 1), cls: "sat-file-name" });
    details.createDiv({ text: record.path, cls: "sat-file-path" });
    details.createDiv({
      text: `${exists ? this.plugin.t("fileExists") : this.plugin.t("fileMissing")} • ${this.plugin.t("protectedAt", { value: formatDate(record.addedAt, this.plugin.locale) })}`,
      cls: "sat-file-meta"
    });

    const actions = row.createDiv({ cls: "sat-record-actions" });
    if (exists) this.addRowButton(actions, this.plugin.t("open"), "", () => this.plugin.openVaultFile(record.path));
    this.addRowButton(actions, this.plugin.t("allowAgain"), "", async () => {
      await this.plugin.unprotectPaths([record.path]);
    });
    if (exists) row.addEventListener("click", () => void this.plugin.openVaultFile(record.path));
  }

  private filteredCandidates(): ScanCandidate[] {
    const query = this.normalizedQuery();
    const items = this.plugin.getScanCandidates();
    if (!query) return items;
    return items.filter((item) => `${item.name} ${item.path}`.toLocaleLowerCase().includes(query));
  }

  private filteredTrashRecords(): TrashRecord[] {
    const query = this.normalizedQuery();
    const records = this.plugin.store.list();
    if (!query) return records;
    return records.filter((record) =>
      `${record.fileName} ${record.originalPath ?? ""} ${record.trashPath ?? ""} ${record.reason}`.toLocaleLowerCase().includes(query)
    );
  }

  private filteredProtectedFiles(): ProtectedFileRecord[] {
    const query = this.normalizedQuery();
    const records = this.plugin.getProtectedFiles();
    if (!query) return records;
    return records.filter((record) => record.path.toLocaleLowerCase().includes(query));
  }

  private normalizedQuery(): string {
    return this.searchQuery.trim().toLocaleLowerCase();
  }

  private filteredItemCount(): number {
    if (this.activeSection === "unused") return this.filteredCandidates().length;
    if (this.activeSection === "trash") return this.filteredTrashRecords().length;
    return this.filteredProtectedFiles().length;
  }

  private selectedCount(): number {
    if (this.activeSection === "unused") return this.selectedCandidatePaths.size;
    if (this.activeSection === "trash") return this.selectedTrashIds.size;
    return this.selectedProtectedPaths.size;
  }

  private selectedVisibleCount(): number {
    if (this.activeSection === "unused") return this.filteredCandidates().filter((item) => this.selectedCandidatePaths.has(item.path)).length;
    if (this.activeSection === "trash") return this.filteredTrashRecords().filter((item) => this.selectedTrashIds.has(item.id)).length;
    return this.filteredProtectedFiles().filter((item) => this.selectedProtectedPaths.has(item.path)).length;
  }

  private setAllVisibleSelected(selected: boolean): void {
    if (this.activeSection === "unused") {
      for (const item of this.filteredCandidates()) selected
        ? this.selectedCandidatePaths.add(item.path)
        : this.selectedCandidatePaths.delete(item.path);
      return;
    }
    if (this.activeSection === "trash") {
      for (const item of this.filteredTrashRecords()) selected
        ? this.selectedTrashIds.add(item.id)
        : this.selectedTrashIds.delete(item.id);
      return;
    }
    for (const item of this.filteredProtectedFiles()) selected
      ? this.selectedProtectedPaths.add(item.path)
      : this.selectedProtectedPaths.delete(item.path);
  }

  private searchPlaceholder(): string {
    if (this.activeSection === "unused") return this.plugin.t("searchUnusedPlaceholder");
    if (this.activeSection === "protected") return this.plugin.t("searchProtectedPlaceholder");
    return this.plugin.t("searchPlaceholder");
  }

  private addToolbarButton(
    parent: HTMLElement,
    label: string,
    className: string,
    onClick: () => Promise<void> | void
  ): void {
    const button = parent.createEl("button", { text: label, cls: className });
    button.addEventListener("click", () => {
      void this.runButtonAction(button, onClick);
    });
  }

  private addRowButton(
    parent: HTMLElement,
    label: string,
    className: string,
    onClick: () => Promise<void> | void
  ): void {
    const button = parent.createEl("button", { text: label, cls: className });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.runButtonAction(button, onClick);
    });
  }

  private async runButtonAction(button: HTMLButtonElement, onClick: () => Promise<void> | void): Promise<void> {
    button.disabled = true;
    try {
      await onClick();
    } finally {
      button.disabled = false;
    }
  }

  private noticeNoneSelected(): void {
    new Notice(this.plugin.t("noneSelected"));
  }

  private async restoreOne(record: TrashRecord): Promise<void> {
    try {
      const restoredPath = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior, this.plugin.settings.recoveryFolder);
      if (restoredPath) new Notice(this.plugin.t("restoreSuccess", { path: restoredPath }));
      else new Notice(this.plugin.t("restoreSkipped"));
      await this.plugin.refreshOpenViews();
    } catch (error) {
      new Notice(this.plugin.t("restoreFailed", { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  private async restoreSelected(): Promise<void> {
    const records = [...this.selectedTrashIds]
      .map((id) => this.plugin.store.get(id))
      .filter((record): record is TrashRecord => record !== undefined);
    if (records.length === 0) return this.noticeNoneSelected();

    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of records) {
      try {
        const result = await this.plugin.store.restore(record, this.plugin.settings.conflictBehavior, this.plugin.settings.recoveryFolder);
        if (result) restored += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
    this.selectedTrashIds.clear();
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
    const records = [...this.selectedTrashIds]
      .map((id) => this.plugin.store.get(id))
      .filter((record): record is TrashRecord => record !== undefined);
    if (records.length === 0) return this.noticeNoneSelected();

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
        this.selectedTrashIds.clear();
        new Notice(this.plugin.t("deleteResult", { deleted, failed }));
        await this.plugin.refreshOpenViews();
      }
    ).open();
  }
}
