FROM node:22.23.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8090 \
    MAZANN_CACHE_DIR=/app/data/runtime/cache \
    MAZANN_SEED_CACHE_DIR=/app/data/cache \
    MAZANN_CACHE_WRITE=true

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/connectors/islamic-content/package.json packages/connectors/islamic-content/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY apps ./apps
COPY packages ./packages
COPY data ./data

RUN mkdir -p /app/data/runtime/cache && chown -R node:node /app/data/runtime

USER node
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8090/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["npm", "start"]
