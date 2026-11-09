#!/bin/sh
set -e

# Default CLEARPANEL_URL pointing to ClearPanel backend on port 3334
export CLEARPANEL_URL="${CLEARPANEL_URL:-http://host.docker.internal:3334}"

echo "Starting ClearMail on Port 7510..."
echo "ClearPanel Backend Target: $CLEARPANEL_URL"

# Substitute environment variables into nginx config
envsubst '${CLEARPANEL_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Execute CMD (nginx)
exec "$@"

