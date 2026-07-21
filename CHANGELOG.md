# Changelog

## 0.3.1

- Remove the redundant product name from the plugin description to satisfy community directory validation.

## 0.3.0

- Store recoverable files in Obsidian's built-in `.trash` instead of `.safe-attachment-trash`.
- Use `FileManager.trashFile()` to respect the user's deletion preference.
- Create a local `.trash` recovery copy when the original is sent to system trash or permanently deleted.
- Persist restore metadata through plugin data.
- Discover and preview existing local-trash files.
- Track original paths for plugin moves and observable local manual deletions.
- Restore unknown-path files to a configurable recovery folder.
- Safely migrate legacy plugin-trash files.
- Adopt Obsidian 1.13 declarative settings and searchable settings.
- Add lint and automated storage/migration tests to the release workflow.
