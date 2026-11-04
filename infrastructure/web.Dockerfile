# Builds the Mini App and the admin panel, serves both with Caddy (automatic HTTPS).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/miniapp/package.json apps/miniapp/
COPY apps/admin/package.json apps/admin/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci
COPY . .
ARG BOT_USERNAME=Rusada_QuizBot
# API is served from the same domain under /api → empty base URL
ENV VITE_API_URL="" VITE_BOT_USERNAME=$BOT_USERNAME
RUN npm run build -w @rq/miniapp && npm run build -w @rq/admin

FROM caddy:2.10-alpine
COPY infrastructure/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/apps/miniapp/dist /srv/miniapp
COPY --from=build /src/apps/admin/dist /srv/admin
