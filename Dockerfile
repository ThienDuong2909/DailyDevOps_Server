FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk upgrade --no-cache \
    && apk add --no-cache openssl \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -rf /usr/local/bin/npm /usr/local/bin/npx \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 expressjs

COPY --from=builder /app/package*.json ./
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=expressjs:nodejs /app/public ./public
COPY --from=builder --chown=expressjs:nodejs /app/src ./src

USER expressjs

EXPOSE 3001

CMD ["node", "src/server.js"]
