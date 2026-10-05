# Public-link deployment

This deployment exposes only Caddy on ports 80/443. The application remains on an internal Docker network. There is no reviewer login: anyone with the URL can open the site and invoke its public research APIs. Share the URL deliberately, monitor API usage, and do not treat a private message or an unlisted URL as access control. Saved research is separated by a random browser workspace ID, **not** by authenticated user accounts; do not enter confidential personal information.

## Server prerequisites

- A Linux server with Docker Engine and Docker Compose v2.
- TCP ports 22, 80 and 443 open; UDP 443 is optional but enables HTTP/3.
- A DNS A record pointing the chosen hostname to the server.
- A fresh, restricted OpenAI API key with spending limits. Never reuse a key that appeared in terminal or chat output.

## First deployment

```bash
git clone https://github.com/zenkri-ux/mazann.git
cd mazann
cp deploy/.env.production.example deploy/.env.production
```

Set the hostname, ACME email, exact Git commit, model and a fresh API key in `deploy/.env.production`.

```bash
git checkout <exact-commit>
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml config --quiet
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml up --build -d
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml ps
```

Verify HTTPS and application health:

```bash
curl -I https://preview.example.com
curl https://preview.example.com/api/health
```

The first request must return `200`; the health request must return JSON with `status: ok`. Project APIs require the browser-generated `x-mazann-workspace` ID and reject requests without it; that ID is not an account or strong access control.

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
