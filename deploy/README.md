# Private beta deployment

This deployment exposes only Caddy on ports 80/443. The application remains on an internal Docker network and is protected by a shared beta login. Saved research is currently a shared workspace, so only invite trusted reviewers and do not treat it as account isolation.

## Server prerequisites

- A Linux server with Docker Engine and Docker Compose v2.
- TCP ports 22, 80 and 443 open; UDP 443 is optional but enables HTTP/3.
- A DNS A record pointing the chosen hostname to the server.
- A fresh, restricted OpenAI API key. Never reuse a key that appeared in terminal or chat output.

## First deployment

```bash
git clone https://github.com/zenkri-ux/mazann.git
cd mazann
cp deploy/.env.production.example deploy/.env.production
docker run --rm caddy:2.10.2-alpine caddy hash-password --plaintext 'A-LONG-UNIQUE-BETA-PASSWORD'
```

Place the generated hash in `deploy/.env.production`. Keep the single quotes around bcrypt hashes so dollar signs remain literal. Then set the hostname, ACME email, exact Git commit, model and a fresh API key.

```bash
git checkout <exact-commit>
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml config --quiet
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml up --build -d
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml ps
```

Verify both the gate and application health:

```bash
curl -I https://preview.example.com
curl -u 'reviewer:A-LONG-UNIQUE-BETA-PASSWORD' https://preview.example.com/api/health
```

The first request must return `401`; the authenticated health request must return JSON with `status: ok`.

## Server with an existing Caddy gateway

When ports 80/443 are already owned by a trusted Caddy container, do not start a second gateway or expose the application directly. Use `compose.shared-caddy.yaml`, set `SHARED_GATEWAY_NETWORK` to the existing Caddy network, and add the reviewed block from `Caddyfile.shared-snippet.example` to that gateway. Validate the complete Caddyfile before reloading it.

```bash
docker compose --env-file deploy/.env.production -f deploy/compose.shared-caddy.yaml up --build -d
docker exec <existing-caddy-container> caddy validate --config /etc/caddy/Caddyfile
docker exec <existing-caddy-container> caddy reload --config /etc/caddy/Caddyfile
```

## Update and rollback

Before an update, record the healthy commit. Pull and deploy only a tested commit:

```bash
git fetch origin
git checkout <tested-commit>
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml up --build -d
```

Rollback by checking out the previous healthy commit and running the same `up --build -d` command. The named runtime volume keeps saved projects and cache across container replacements.

## Reviewer reset

Saved projects are in the `mazann-production_mazann-runtime` Docker volume. Do not delete that volume unless the owner explicitly approves erasing all beta research. To stop the service without deleting data:

```bash
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml down
```
