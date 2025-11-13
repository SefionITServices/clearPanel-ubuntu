#!/bin/bash
# clearPanel Backend Startup Script

cd /home/hasim/Documents/project/clearPanel/backend

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Generate random session secret if not set
if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "change-this-to-a-random-secure-string" ]; then
    export SESSION_SECRET=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 32)
fi

# Start the backend
nohup node dist/main.js > server.log 2>&1 &

echo "Backend started with PID $!"
echo "Logs: /home/hasim/Documents/project/clearPanel/backend/server.log"
echo "Config: PORT=$PORT, NODE_ENV=$NODE_ENV"
echo "Paths: ROOT_PATH=$ROOT_PATH, DOMAINS_ROOT=$DOMAINS_ROOT"
