# syntax=docker/dockerfile:1

# Stage 1: Build Stage
FROM node:22-alpine as builder

WORKDIR /app

# Give yarn a bit of room to survive brief registry blips without hanging
# for minutes on a dead connection.
ENV YARN_HTTP_RETRY=3 \
    YARN_HTTP_TIMEOUT=60000

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./

RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

COPY . .

RUN yarn build

#  Stage 2: Production Stage
FROM node:22-alpine as runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]