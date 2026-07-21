# Changelog

## 0.4.1

- Restored compatibility with the current public app release line and lowered `minAppVersion` to `1.8.7`.
- Removed all use of the 1.13-only declarative settings API.
- Pinned development typings to the public 1.12 API line.
- Fixed all unsafe regex match calls reported in `src/scanner.ts`.
- Expanded the README into complete English and Persian user guides.
- Added separate English and Persian interface illustrations for scanning, settings, protected files, and trash actions.


## 0.4.0

- Added optional automatic scanning when the panel opens.
- Changed scanning to a read-only review process: scans never move or delete files.
- Added an Unused tab with open, move-to-trash, and never-suggest actions.
- Added a Protected tab and bulk protection management.
- Added a manual Scan and refresh workflow.
- Added frontmatter/property and Bases reference detection.
- Added a final re-check before moving selected files to trash.
- Reworked the README with a user-focused guide and interface illustrations.

## 0.3.1

- Fixed the community-directory manifest description validation.

## 0.3.0

- Moved recoverable files to the local `.trash` workflow.
- Added original-path metadata, migration, and declarative settings.
