#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  Launching ClearMail Webmail on Port 7510    "
echo "=============================================="

docker compose -f docker-compose.clearmail.yml up --build -d

echo ""
echo ">>> ClearMail Webmail is LIVE at: http://localhost:7510/"
echo ">>> To point a subdomain later (e.g. mail.yourdomain.com):"
echo "    Proxy your subdomain directly to http://127.0.0.1:7510"
echo ""

