# syntax=docker/dockerfile:1

# Stage 1: Build Stage
FROM node:22-alpine as builder

WORKDIR /app

# Give npm more room to survive flaky registry connections in CI, without
# any extra network round-trip (no `npm install -g npm@...` step needed).
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

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