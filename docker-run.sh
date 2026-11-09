#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Building & Starting ClearPanel (Port 7510) "
echo "=========================================="

docker compose up --build -d

echo ""
echo ">>> ClearPanel Admin Dashboard: http://localhost:7510/"
echo ">>> ClearMail Business Webmail: http://localhost:7510/clearmail/"
echo ">>> API Status:                 http://localhost:7510/api/mail/status"
echo ""

