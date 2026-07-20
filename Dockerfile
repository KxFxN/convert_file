# syntax=docker/dockerfile:1

# Stage 1: Build Stage
FROM node:22-alpine as builder

WORKDIR /app

# Work around npm/cli#7657 ("Exit handler never called!"), which surfaces
# under slow/flaky registry connections in CI: use a patched npm version,
# skip the extra audit/fund network calls, and give fetches more room to retry.
RUN npm install -g npm@11 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-timeout 300000

COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .

RUN npm run build

#  Stage 2: Production Stage
FROM node:22-alpine as runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

EXPOSE 3000

CMD ["npm", "start"]