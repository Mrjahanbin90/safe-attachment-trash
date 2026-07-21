# Releasing

## Version 0.4.1

This patch restores compatibility with the public 1.12 release line, removes the unreleased settings API dependency, fixes scanner lint warnings, and publishes complete English and Persian documentation.

1. Run `npm ci`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Confirm `manifest.json`, `package.json`, and `package-lock.json` are all version `0.4.1`.
7. Commit and push the source.
8. Create and push tag `0.4.1`.
9. The release workflow builds, attests, and uploads `main.js`, `manifest.json`, and `styles.css`.
