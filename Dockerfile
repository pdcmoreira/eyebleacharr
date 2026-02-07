# Multi-stage build
FROM node:20-slim AS builder

# Install dependencies for building
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and install pnpm
RUN corepack enable
RUN corepack prepare pnpm@10.27.0 --activate

# Set working directory
WORKDIR /app

# Copy package.json files and pnpm workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY shared/ ./shared/

# Build backend and frontend
RUN pnpm run build

# Production stage
FROM node:20-slim AS production

# Enable corepack and install pnpm
RUN corepack enable
RUN corepack prepare pnpm@10.27.0 --activate

# Install PM2 globally
RUN npm install -g pm2

# Create app directory
WORKDIR /app

# Copy workspace configuration and package.json files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies (drizzle-orm included, no drizzle-kit needed)
RUN pnpm install --prod --frozen-lockfile

# Copy backend built files and migration SQL files
COPY backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist/
COPY --from=builder /app/backend/drizzle ./backend/drizzle/

# Copy shared source
COPY shared/ ./shared/

# Copy built frontend
COPY --from=builder /app/frontend/dist ./frontend/dist/

# Copy PM2 configuration and entrypoint
COPY ecosystem.config.js ./
COPY docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

# Create data and PM2 directories with world-writable permissions
# This allows the container to run with any user ID specified in docker-compose
RUN mkdir -p /app/data /app/.pm2 && \
  chmod -R 777 /app/data /app/.pm2

# Set PM2 home directory
ENV PM2_HOME=/app/.pm2

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application (runs migrations then PM2)
CMD ["/app/docker-entrypoint.sh"]