# syntax=docker/dockerfile:1

# litbase has no backend of its own — the browser talks to api.kickbase.com
# directly — so the image is nothing but the built bundle behind nginx.

# ---------------------------------------------------------------- build ----
FROM node:22-alpine AS build

WORKDIR /app

# Manifests first: this layer is only rebuilt when the lockfile actually moves.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines import.meta.env at build time, so these are build args, not
# runtime env — changing them means rebuilding the image. Left empty they are
# falsy, and src/lib/env.ts falls back to the live API and CDN.
ARG VITE_API_BASE_URL=
ARG VITE_CDN_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_CDN_BASE_URL=$VITE_CDN_BASE_URL

# Typechecks first (`tsc -b`), then bundles to dist/.
RUN npm run build

# Pre-compress once here rather than per request at runtime; nginx serves the
# .gz siblings via gzip_static. -k keeps the originals for clients without gzip.
RUN find dist -type f -size +1k \
      \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \
         -o -name '*.json' -o -name '*.map' \) \
      -exec gzip -9 -k {} +

# -------------------------------------------------------------- runtime ----
FROM nginx:1.29-alpine AS runtime

# Replaces the stock config wholesale — it carries the single server block and
# does not include conf.d, so the image's default.conf is inert.
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Unprivileged: nginx.conf keeps the pid and every temp path under /tmp, and
# listens above 1024. The official entrypoint skips its root-only init scripts
# on its own when the container is not running as root.
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
