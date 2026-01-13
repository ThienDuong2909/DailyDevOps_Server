# Stage 1: Install dependencies and Build
FROM node:18-alpine AS builder
WORKDIR /app

# Install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Stage 2: Production Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
# We copy package files and run npm ci --omit=dev to get a clean node_modules
# This prevents carrying over tools like nodemon, eslint, etc.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy source code
COPY ./src ./src
COPY ./prisma ./prisma

# Copy the generated Prisma Client from the builder stage
# The generated client is typically stored in node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER expressjs

EXPOSE 3001

CMD ["npm", "start"]
