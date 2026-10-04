# Contributing

## Workflow

1. Create a short-lived branch from `main`.
2. Keep changes inside the owning app or package; change a contract explicitly when crossing a boundary.
3. Add or update tests for validation, fallback and failure behavior.
4. Run `npm test`, then build the container when runtime behavior changes.
5. Open a pull request using the repository template.

## Commit convention

Use concise conventional prefixes: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`.

## Non-negotiable review gates

- Never hand-edit retrieved Quran or Hadith text.
- Never commit `.env`, keys, reviewer identities or private user content.
- Never present a search excerpt as a verified evidence record.
- Preserve citation URLs, checksums and source versions.
- A sacred-text mismatch, fabricated citation or false verification badge blocks merging and deployment.
