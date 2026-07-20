# syntax=docker/dockerfile:1

# Stage 1: Build Stage
FROM node:22-alpine as builder

WORKDIR /app

# Fail fast instead of hanging for minutes on a dead connection while we
# diagnose the CI network issue.
ENV NPM_CONFIG_FETCH_RETRIES=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=5000 \
    NPM_CONFIG_FETCH_TIMEOUT=60000

# --- TEMPORARY DIAGNOSTIC: remove after we identify the CI network issue ---
RUN echo "MTU: $(cat /sys/class/net/eth0/mtu 2>/dev/null || echo unknown)"; \
    (time npm view react version) || echo "SMALL_OP_FAILED"; \
    (time npm pack react --pack-destination /tmp) || echo "TARBALL_FAILED"
# --- END DIAGNOSTIC ---

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