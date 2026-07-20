# syntax=docker/dockerfile:1

# Stage 1: Build Stage
FROM node:22-alpine as builder

WORKDIR /app

# Give npm a bit of room to survive brief registry blips without hanging
# for minutes on a dead connection.
ENV NPM_CONFIG_FETCH_RETRIES=3 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_TIMEOUT=60000

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