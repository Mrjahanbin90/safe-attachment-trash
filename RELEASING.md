# Releasing

1. Update the version in `manifest.json`, `package.json`, and `versions.json` when the minimum supported Obsidian version changes.
2. Commit and push the changes.
3. Create and push a tag that exactly matches the manifest version, for example:

```bash
git tag 0.2.2
git push origin 0.2.2
```

The GitHub Actions workflow builds the plugin, type-checks it, creates artifact attestations, and uploads `main.js`, `manifest.json`, and `styles.css` to the matching GitHub release.
