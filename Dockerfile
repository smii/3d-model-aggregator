# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder — installs deps (better-sqlite3 is a native module, so a toolchain is
# needed), generates the Prisma client and builds Next.js.
# Debian (not Alpine) on purpose: Prisma's engines target debian-openssl-3.0.x
# and better-sqlite3 needs glibc.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    DATABASE_URL="file:/data/app.db"

# package.json has a postinstall that runs `prisma generate`, so the schema and
# prisma.config.ts must be present before `npm ci`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# AUTH_SECRET is only a build-time placeholder: next-auth is imported by the
# root layout, and the real value is injected at runtime from your .env.
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

RUN npx prisma generate && npm run build && rm -rf .next/cache

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/data/app.db" \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=builder --chown=node:node /app /app

# Chromium is only needed for the "Account Sync" scrapers (Playwright).
# Adds roughly 500 MB — build with --build-arg WITH_PLAYWRIGHT=false to skip it.
ARG WITH_PLAYWRIGHT=true
RUN if [ "$WITH_PLAYWRIGHT" = "true" ]; then \
        npx playwright install --with-deps chromium && \
        rm -rf /var/lib/apt/lists/*; \
    else \
        echo "Skipping Chromium — account sync will not work in this image."; \
    fi

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data && chown -R node:node /data

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
