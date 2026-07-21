import { App, PluginSettingTab, Setting } from "obsidian";
import type SafeAttachmentTrashPlugin from "./main";
import type { ConflictBehavior, LanguageMode, SafeTrashSettings } from "./types";

export const DEFAULT_SETTINGS: SafeTrashSettings = {
  language: "auto",
  extensions: "png, jpg, jpeg, gif, webp, bmp, svg, avif, pdf, mp3, wav, ogg, m4a, flac, mp4, webm, mov, m4v, doc, docx, xls, xlsx, ppt, pptx, zip, rar, 7z, txt, csv",
  excludedFolders: "Templates",
  minimumAgeHours: 0,
  conflictBehavior: "rename",
  scanCanvasFiles: true
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
        .onChange(async (value) => {
          this.plugin.settings.language = value as LanguageMode;
          await this.plugin.saveSettings();
          await this.plugin.refreshLanguage();
          this.display();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsExtensions"))
      .setDesc(this.plugin.t("settingsExtensionsDesc"))
      .addTextArea((text) => text
        .setValue(this.plugin.settings.extensions)
        .onChange(async (value) => {
          this.plugin.settings.extensions = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsExcluded"))
      .setDesc(this.plugin.t("settingsExcludedDesc"))
      .addTextArea((text) => text
        .setValue(this.plugin.settings.excludedFolders)
        .onChange(async (value) => {
          this.plugin.settings.excludedFolders = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsMinAge"))
      .setDesc(this.plugin.t("settingsMinAgeDesc"))
      .addText((text) => text
        .setPlaceholder("0")
        .setValue(String(this.plugin.settings.minimumAgeHours))
        .onChange(async (value) => {
          const parsed = Number(value);
          this.plugin.settings.minimumAgeHours = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsConflict"))
      .setDesc(this.plugin.t("settingsConflictDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("rename", this.plugin.t("conflictRename"))
        .addOption("skip", this.plugin.t("conflictSkip"))
        .addOption("overwrite", this.plugin.t("conflictOverwrite"))
        .setValue(this.plugin.settings.conflictBehavior)
        .onChange(async (value) => {
          this.plugin.settings.conflictBehavior = value as ConflictBehavior;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(this.plugin.t("settingsCanvas"))
      .setDesc(this.plugin.t("settingsCanvasDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.scanCanvasFiles)
        .onChange(async (value) => {
          this.plugin.settings.scanCanvasFiles = value;
          await this.plugin.saveSettings();
        }));
  }
}
