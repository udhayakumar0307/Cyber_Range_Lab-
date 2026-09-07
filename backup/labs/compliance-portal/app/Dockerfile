# Single container: Vite frontend built to static files, served by the Express
# API on the same origin. One port, one process, no database required.
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# The browser calls the API on the same origin it was served from, so the base
# URL is relative and nothing host-specific is baked into the bundle. Anything
# environment-specific (keys, source URLs, sectors) is read by the server at
# runtime from CONSENT_SOURCES, never at build time.
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server ./server
COPY data ./data
COPY src/mock ./src/mock
COPY docker-entrypoint.sh ./
COPY --from=build /app/dist ./dist

# Run unprivileged. Strip any CR the checkout host may have added so the
# `#!/bin/sh` line is valid inside the container regardless of git autocrlf.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh \
 && addgroup -S app && adduser -S app -G app \
 && chown -R app:app /app
USER app

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint only fills in a self-contained demo CONSENT_SOURCES when none
# was supplied, then runs the CMD unchanged.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
