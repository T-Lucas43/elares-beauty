FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG RELEASE_SHA=local
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_DEMO_MODE=true
RUN BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime-2026 NODE_OPTIONS=--max-old-space-size=2048 npm run build
RUN npm prune --omit=dev && rm -rf .next/cache
RUN node -e "require('fs').writeFileSync('release.json',JSON.stringify({sha:process.argv[1]}))" "$RELEASE_SHA"
FROM build AS package
RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/*
RUN RELEASE_SHA="$RELEASE_SHA" node scripts/package-release.mjs
RUN cd release-package && zip -qr /elares-beauty-shard.zip .
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=256 DATABASE_POOL_SIZE=5
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/release.json ./release.json
USER node
EXPOSE 3000
CMD ["node","scripts/start.mjs"]
