# ==============================================================================
# ClearPanel Multi-Stage Production Dockerfile
# Serves: ClearPanel Admin Dashboard + ClearMail Webmail + NestJS API
# Default Port: 7510
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React Frontend (Vite)
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /build/frontend

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm ci || npm install

# Build frontend to backend/public
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Server Runner
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

# Install essential dependencies for native addons (node-pty) & runtime tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure Production Environment Variables
ENV NODE_ENV=production
ENV PORT=7510
ENV DATA_DIR=/app/data
ENV MAIL_MODE=production

# Setup and Build Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci || npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src

# Compile NestJS TypeScript to dist/
RUN npm run build

# Copy React Frontend bundle into backend/public
COPY --from=frontend-builder /build/backend/public ./public

# Copy pre-compiled ClearMail Flutter Web Client into public/clearmail & apps directory
COPY apps/clearmail_flutter/build/web ./public/clearmail
COPY apps/clearmail_flutter/build/web /app/apps/clearmail_flutter/build/web

# Create persistent storage directories
RUN mkdir -p /app/data /etc/clearpanel/mail /app/backend/mail-state

# Expose requested port 7510
EXPOSE 7510

# Declare persistent volumes
VOLUME ["/app/data", "/etc/clearpanel"]

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:7510/api/mail/status || exit 1

# Launch ClearPanel on port 7510
CMD ["node", "dist/main.js"]

