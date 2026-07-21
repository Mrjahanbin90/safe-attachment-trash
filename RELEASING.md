# Releasing

## Version 0.3.0

This release migrates storage from the plugin-specific `.safe-attachment-trash` folder to Obsidian's built-in `.trash`, adopts the Obsidian 1.13 declarative settings API, and keeps recovery metadata in plugin data.

1. Run `npm ci`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Commit and push the source.
7. Create and push tag `0.3.0`.
8. The release workflow builds, attests, and uploads `main.js`, `manifest.json`, and `styles.css`.
