# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

FROM ${NODE_IMAGE} AS base

ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@11.2.2 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN pnpm build \
    && test -f .next/standalone/server.js

FROM ${NODE_IMAGE} AS runner

ARG AZURE_CLI_VERSION=2.88.0-1~bookworm

ENV AZURE_CONFIG_DIR=/app/.azure
ENV AZURE_CORE_COLLECT_TELEMETRY=no
ENV HOME=/home/app
ENV HOSTNAME=0.0.0.0
ENV LOCAL_SETTINGS_DATABASE_PATH=/data/settings.sqlite
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3002

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && mkdir --parents /etc/apt/keyrings \
    && install --directory --mode 0700 /tmp/gnupg \
    && curl --fail --location --show-error --silent \
        --output /tmp/microsoft.asc \
        https://packages.microsoft.com/keys/microsoft.asc \
    && test "$(gpg --batch --homedir /tmp/gnupg \
        --show-keys --with-colons /tmp/microsoft.asc \
        | awk -F: '$1 == "fpr" { print $10; exit }')" \
        = "BC528686B50D79E339D3721CEB3E94ADBE1229CF" \
    && gpg --batch --homedir /tmp/gnupg --dearmor \
        --output /etc/apt/keyrings/microsoft.gpg \
        /tmp/microsoft.asc \
    && chmod go+r /etc/apt/keyrings/microsoft.gpg \
    && printf '%s\n' \
        'Types: deb' \
        'URIs: https://packages.microsoft.com/repos/azure-cli/' \
        'Suites: bookworm' \
        'Components: main' \
        "Architectures: $(dpkg --print-architecture)" \
        'Signed-by: /etc/apt/keyrings/microsoft.gpg' \
        > /etc/apt/sources.list.d/azure-cli.sources \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
        "azure-cli=${AZURE_CLI_VERSION}" \
    && az version --output json > /dev/null \
    && apt-get purge --yes --auto-remove curl gnupg \
    && rm --force /tmp/microsoft.asc \
    && rm --recursive --force \
        /opt/yarn-v${YARN_VERSION} \
        /tmp/gnupg \
        /usr/local/lib/node_modules/corepack \
        /usr/local/lib/node_modules/npm \
        /var/lib/apt/lists/* \
    && rm --force \
        /usr/local/bin/corepack \
        /usr/local/bin/npm \
        /usr/local/bin/npx \
        /usr/local/bin/yarn \
        /usr/local/bin/yarnpkg

RUN groupadd --gid 10001 app \
    && useradd \
        --create-home \
        --gid 10001 \
        --home-dir /home/app \
        --shell /usr/sbin/nologin \
        --uid 10001 \
        app \
    && mkdir --parents /app/.azure /app/.next/cache /data \
    && chown --recursive 10001:10001 /app /data /home/app

COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/drizzle ./drizzle
COPY --from=builder --chown=10001:10001 /app/public ./public

LABEL org.opencontainers.image.source="https://github.com/austin-smith/better-azure-devops"

USER 10001:10001

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3002/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

STOPSIGNAL SIGTERM

CMD ["node", "server.js"]
