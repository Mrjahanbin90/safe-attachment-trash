import { App, normalizePath, PluginSettingTab, Setting } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { ConflictBehavior, LanguageMode, SafeTrashSettings } from "./types";

export const DEFAULT_SETTINGS: SafeTrashSettings = {
  language: "auto",
  autoScanOnPanelOpen: true,
  extensions: "png, jpg, jpeg, gif, webp, bmp, svg, avif, pdf, mp3, wav, ogg, m4a, flac, mp4, webm, mov, m4v, doc, docx, xls, xlsx, ppt, pptx, zip, rar, 7z, txt, csv",
  excludedFolders: "Templates",
  minimumAgeHours: 0,
  conflictBehavior: "rename",
  scanCanvasFiles: true,
  recoveryFolder: "Recovered from Trash"
};

export class SafeTrashSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SafeAttachmentTrashPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("sat-settings");
    containerEl.dir = this.plugin.language === "fa" ? "rtl" : "ltr";

    new Setting(containerEl)
      .setName(this.plugin.t("settingsLanguage"))
      .setDesc(this.plugin.t("settingsLanguageDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("auto", this.plugin.t("languageAuto"))
        .addOption("fa", this.plugin.t("languagePersian"))
        .addOption("en", this.plugin.t("languageEnglish"))
        .setValue(this.plugin.settings.language)
        .onChange((value) => {
          void this.changeLanguage(value);
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsAutoScan"))
      .setDesc(this.plugin.t("settingsAutoScanDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoScanOnPanelOpen)
        .onChange((value) => {
          this.plugin.settings.autoScanOnPanelOpen = value;
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsExtensions"))
      .setDesc(this.plugin.t("settingsExtensionsDesc"))
      .addTextArea((text) => text
        .setValue(this.plugin.settings.extensions)
        .onChange((value) => {
          this.plugin.settings.extensions = value;
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsExcluded"))
      .setDesc(this.plugin.t("settingsExcludedDesc"))
      .addTextArea((text) => text
        .setValue(this.plugin.settings.excludedFolders)
        .onChange((value) => {
          this.plugin.settings.excludedFolders = value;
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsMinAge"))
      .setDesc(this.plugin.t("settingsMinAgeDesc"))
      .addText((text) => text
        .setPlaceholder("0")
        .setValue(String(this.plugin.settings.minimumAgeHours))
        .onChange((value) => {
          const parsed = Number(value);
          this.plugin.settings.minimumAgeHours = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsConflict"))
      .setDesc(this.plugin.t("settingsConflictDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("rename", this.plugin.t("conflictRename"))
        .addOption("skip", this.plugin.t("conflictSkip"))
        .addOption("overwrite", this.plugin.t("conflictOverwrite"))
        .setValue(this.plugin.settings.conflictBehavior)
        .onChange((value) => {
          this.plugin.settings.conflictBehavior = this.asConflictBehavior(value);
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsRecoveryFolder"))
      .setDesc(this.plugin.t("settingsRecoveryFolderDesc"))
      .addText((text) => text
        .setPlaceholder(DEFAULT_SETTINGS.recoveryFolder)
        .setValue(this.plugin.settings.recoveryFolder)
        .onChange((value) => {
          this.plugin.settings.recoveryFolder = this.normalizeRecoveryFolder(value);
          void this.plugin.saveState();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsCanvas"))
      .setDesc(this.plugin.t("settingsCanvasDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.scanCanvasFiles)
        .onChange((value) => {
          this.plugin.settings.scanCanvasFiles = value;
          void this.plugin.saveState();
        }));
  }

  private async changeLanguage(value: string): Promise<void> {
    this.plugin.settings.language = this.asLanguage(value);
    await this.plugin.saveState();
    await this.plugin.refreshLanguage();
    this.display();
  }

  private normalizeRecoveryFolder(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_SETTINGS.recoveryFolder;
    const normalized = normalizePath(trimmed);
    if (normalized.startsWith(".") || normalized.split("/").includes("..")) {
      return DEFAULT_SETTINGS.recoveryFolder;
    }
    return normalized;
  }

  private asLanguage(value: string): LanguageMode {
    return value === "fa" || value === "en" || value === "auto" ? value : DEFAULT_SETTINGS.language;
  }

  private asConflictBehavior(value: string): ConflictBehavior {
    return value === "rename" || value === "skip" || value === "overwrite"
      ? value
      : DEFAULT_SETTINGS.conflictBehavior;
  }
}
