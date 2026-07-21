import { App, normalizePath, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
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

type SettingKey = keyof SafeTrashSettings;

export class SafeTrashSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SafeAttachmentTrashPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: this.plugin.t("settingsLanguage"),
        desc: this.plugin.t("settingsLanguageDesc"),
        aliases: ["language", "زبان"],
        control: {
          type: "dropdown",
          key: "language",
          defaultValue: DEFAULT_SETTINGS.language,
          options: {
            auto: this.plugin.t("languageAuto"),
            fa: this.plugin.t("languagePersian"),
            en: this.plugin.t("languageEnglish")
          }
        }
      },
      {
        name: this.plugin.t("settingsAutoScan"),
        desc: this.plugin.t("settingsAutoScanDesc"),
        aliases: ["automatic scan", "auto scan", "اسکن خودکار"],
        control: {
          type: "toggle",
          key: "autoScanOnPanelOpen",
          defaultValue: DEFAULT_SETTINGS.autoScanOnPanelOpen
        }
      },
      {
        name: this.plugin.t("settingsExtensions"),
        desc: this.plugin.t("settingsExtensionsDesc"),
        aliases: ["extensions", "file types", "پسوند"],
        control: {
          type: "textarea",
          key: "extensions",
          defaultValue: DEFAULT_SETTINGS.extensions,
          rows: 4
        }
      },
      {
        name: this.plugin.t("settingsExcluded"),
        desc: this.plugin.t("settingsExcludedDesc"),
        aliases: ["exclude", "ignored folders", "پوشه مستثنا"],
        control: {
          type: "textarea",
          key: "excludedFolders",
          defaultValue: DEFAULT_SETTINGS.excludedFolders,
          rows: 3
        }
      },
      {
        name: this.plugin.t("settingsMinAge"),
        desc: this.plugin.t("settingsMinAgeDesc"),
        aliases: ["age", "hours", "عمر فایل"],
        control: {
          type: "number",
          key: "minimumAgeHours",
          defaultValue: DEFAULT_SETTINGS.minimumAgeHours,
          min: 0,
          step: "any"
        }
      },
      {
        name: this.plugin.t("settingsConflict"),
        desc: this.plugin.t("settingsConflictDesc"),
        aliases: ["restore conflict", "overwrite", "تداخل"],
        control: {
          type: "dropdown",
          key: "conflictBehavior",
          defaultValue: DEFAULT_SETTINGS.conflictBehavior,
          options: {
            rename: this.plugin.t("conflictRename"),
            skip: this.plugin.t("conflictSkip"),
            overwrite: this.plugin.t("conflictOverwrite")
          }
        }
      },
      {
        name: this.plugin.t("settingsRecoveryFolder"),
        desc: this.plugin.t("settingsRecoveryFolderDesc"),
        aliases: ["recovery folder", "unknown path", "پوشه بازیابی"],
        control: {
          type: "text",
          key: "recoveryFolder",
          defaultValue: DEFAULT_SETTINGS.recoveryFolder,
          placeholder: DEFAULT_SETTINGS.recoveryFolder,
          validate: (value) => this.validateRecoveryFolder(value)
        }
      },
      {
        name: this.plugin.t("settingsCanvas"),
        desc: this.plugin.t("settingsCanvasDesc"),
        aliases: ["canvas"],
        control: {
          type: "toggle",
          key: "scanCanvasFiles",
          defaultValue: DEFAULT_SETTINGS.scanCanvasFiles
        }
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (key in this.plugin.settings) return this.plugin.settings[key as SettingKey];
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key as SettingKey) {
      case "language":
        this.plugin.settings.language = this.asLanguage(value);
        await this.plugin.saveState();
        await this.plugin.refreshLanguage();
        this.update();
        break;
      case "autoScanOnPanelOpen":
        this.plugin.settings.autoScanOnPanelOpen = value === true;
        await this.plugin.saveState();
        break;
      case "extensions":
        this.plugin.settings.extensions = typeof value === "string" ? value : DEFAULT_SETTINGS.extensions;
        await this.plugin.saveState();
        break;
      case "excludedFolders":
        this.plugin.settings.excludedFolders = typeof value === "string" ? value : DEFAULT_SETTINGS.excludedFolders;
        await this.plugin.saveState();
        break;
      case "minimumAgeHours": {
        const parsed = typeof value === "number" ? value : Number(value);
        this.plugin.settings.minimumAgeHours = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        await this.plugin.saveState();
        break;
      }
      case "conflictBehavior":
        this.plugin.settings.conflictBehavior = this.asConflictBehavior(value);
        await this.plugin.saveState();
        break;
      case "scanCanvasFiles":
        this.plugin.settings.scanCanvasFiles = value === true;
        await this.plugin.saveState();
        break;
      case "recoveryFolder":
        this.plugin.settings.recoveryFolder = typeof value === "string"
          ? normalizePath(value.trim() || DEFAULT_SETTINGS.recoveryFolder)
          : DEFAULT_SETTINGS.recoveryFolder;
        await this.plugin.saveState();
        break;
    }
  }

  private validateRecoveryFolder(value: string): string | void {
    const trimmed = value.trim();
    if (!trimmed) return this.plugin.t("invalidRecoveryFolder");
    const normalized = normalizePath(trimmed);
    if (normalized.startsWith(".") || normalized.split("/").includes("..")) {
      return this.plugin.t("invalidRecoveryFolder");
    }
  }

  private asLanguage(value: unknown): LanguageMode {
    return value === "fa" || value === "en" || value === "auto" ? value : DEFAULT_SETTINGS.language;
  }

  private asConflictBehavior(value: unknown): ConflictBehavior {
    return value === "rename" || value === "skip" || value === "overwrite"
      ? value
      : DEFAULT_SETTINGS.conflictBehavior;
  }
}
