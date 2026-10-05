# Operations Runbook

## Local modes

- Native: `npm start`
- Container: `docker compose up --build -d`
- Health: `GET /api/health`

The local `.env` uses port `8091` in this workspace because another service owns `8090`. Fresh environments default to `8090`.

The public-link deployment is documented in `deploy/README.md`. It terminates HTTPS at Caddy and keeps the application port on an internal Docker network. There is no reviewer login; the URL is not an access-control boundary. Saved projects require a random browser workspace ID, which is not a substitute for authenticated accounts.

## Runtime data

- `data/cache`: immutable, reviewed seed cache committed with the release.
- `data/runtime/cache`: writable runtime cache; ignored by Git and mounted as a Docker volume.
- The runtime cache shadows the seed by canonical ID. Missing runtime entries fall back to the immutable seed.

## Observability

Current minimum: container health, process logs, explicit upstream error codes, retrieval mode in every response, and checksums in evidence records. Do not log raw user prompts by default.

```bash
docker compose ps
docker compose logs --tail 100 app
```

## Failure behavior

- Live source available: return `retrieval_mode: live` and update runtime cache.
- Live source unavailable + valid cache: return `retrieval_mode: cache`, cache time, and upstream error code.
- Neither available: return `503 EVIDENCE_UNAVAILABLE`; never use model memory or open-web substitution.
- Validation failure: block the record even if upstream returned HTTP 200.

## Deployment gate

1. `npm ci --ignore-scripts`
2. `npm test`
3. `npm run manifest:sources` with no manifest diff
4. `docker build -t mazann:<commit> .`
5. Start the image and wait for healthy status.
6. Test Quran, Hadith, cache fallback and no-cache abstention.
7. Verify no secrets and open the public URL in a clean browser.

## Rollback

Deploy images tagged with the Git commit. Roll back by redeploying the previous healthy image and its matching immutable seed cache. Do not mix a new cache manifest with an older application image.

## Backup and retention

Before submission, retain the final Git commit, source manifest, immutable cache, deck, video and deployment configuration together. Runtime cache is reproducible and not the source of truth.
