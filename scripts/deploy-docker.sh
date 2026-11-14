#!/usr/bin/env bash
# ==============================================================================
# clearPanel - Automated Docker Production Deployment & Healthcheck Script
# ==============================================================================
set -e

# Determine project directory (directory containing docker-compose.yml)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

echo "============================================================"
echo "🚀 clearPanel Docker Deployment - $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "📂 Working directory: ${PROJECT_DIR}"
echo "============================================================"

# 1. Pull latest code from Git if working in a git clone
if [ -d ".git" ]; then
    echo "📦 Pulling latest changes from Git..."
    git pull origin main || echo "⚠️ Warning: git pull returned non-zero, continuing with local files..."
fi

# 2. Build and start containers
echo "🐳 Building & restarting Docker container via Compose..."

# Stop any running containers that might be holding port 7510
docker stop clearmail-web clearpanel 2>/dev/null || true
docker compose down --remove-orphans 2>/dev/null || true

docker compose up --build -d --remove-orphans

# 3. Health Check
echo "🔍 Verifying application health status..."
PORT="${PORT:-7510}"
HEALTH_URL="http://localhost:${PORT}/api/mail/status"
MAX_RETRIES=10
RETRY_DELAY=5
HEALTHY=0

for i in $(seq 1 $MAX_RETRIES); do
    if curl -s -f "${HEALTH_URL}" > /dev/null 2>&1; then
        echo "✅ Health check PASSED on attempt ${i}/${MAX_RETRIES} (${HEALTH_URL})!"
        HEALTHY=1
        break
    fi
    echo "⏳ Waiting for clearPanel service to start... (attempt ${i}/${MAX_RETRIES})"
    sleep "${RETRY_DELAY}"
done

if [ "$HEALTHY" -ne 1 ]; then
    echo "❌ Health check FAILED after $((MAX_RETRIES * RETRY_DELAY)) seconds."
    echo "Recent container logs:"
    docker compose logs --tail=40
    exit 1
fi

# 4. Cleanup old dangling images to conserve server disk space
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "============================================================"
echo "🎉 clearPanel successfully deployed & running on port ${PORT}!"
echo "   Dashboard:  http://localhost:${PORT}/"
echo "   ClearMail:  http://localhost:${PORT}/clearmail/"
echo "   Health API: ${HEALTH_URL}"
echo "============================================================"
